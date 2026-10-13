import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { JOURNEY_SCHEMA, JourneyServiceError } from "../journeys/validation";

type ProviderTiming = { model: string; provider_attempt: number; duration_ms: number; outcome: string; status?: number };
type Callbacks = { onProgress?: (stage: "provider_retry" | "fallback") => void; onModelUsed?: (model: string) => void; onTiming?: (event: ProviderTiming) => void };
function modelId(value: string | undefined) {
  if (!value || !/^[a-zA-Z0-9._-]+$/.test(value)) throw new JourneyServiceError("Journey generation is not configured.");
  return value;
}
export function configuredModel() { return modelId(process.env.GEMINI_MODEL); }
export function configuredFallbackModel() { return modelId(process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite"); }
export function retryableProviderFailure(error: unknown, timedOut = false): boolean {
  const failure = error as { status?: number; name?: string; code?: string; cause?: { code?: string } } | null;
  if (typeof failure?.status === "number") return failure.status === 503 || failure.status === 504;
  return timedOut || failure?.name === "TimeoutError"
    || ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(failure?.cause?.code ?? failure?.code ?? "");
}
function pause(milliseconds: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, milliseconds);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
export async function generateJourneyText(systemPrompt: string, userPrompt: string, model: string, signal: AbortSignal, callbacks: Callbacks = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new JourneyServiceError("Journey generation is not configured.");
  // Explicitly bounded provider recovery; SDK transport retries remain disabled.
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 90_000, retryOptions: { attempts: 1 } } });
  let attempt = 0;
  async function call(actualModel: string) {
    signal.throwIfAborted();
    callbacks.onModelUsed?.(actualModel);
    const started = Date.now();
    const provider_attempt = ++attempt;
    const callSignal = AbortSignal.any([signal, AbortSignal.timeout(actualModel === model ? 60_000 : 12_000)]);
    try {
      const response = await ai.models.generateContent({ model: actualModel, contents: userPrompt,
        config: { systemInstruction: systemPrompt, responseMimeType: "application/json", responseJsonSchema: JOURNEY_SCHEMA,
          maxOutputTokens: 8192, abortSignal: callSignal,
          thinkingConfig: { thinkingLevel: actualModel === "gemini-3.5-flash-lite" ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW } },
      });
      callbacks.onTiming?.({ model: actualModel, provider_attempt, duration_ms: Date.now() - started, outcome: "success" });
      return { text: response.text ?? "", retryable: false };
    } catch (error) {
      const failure = error as { status?: unknown };
      const status = typeof failure.status === "number" ? failure.status : undefined;
      const timedOut = !signal.aborted && callSignal.aborted;
      callbacks.onTiming?.({ model: actualModel, provider_attempt, duration_ms: Date.now() - started, outcome: timedOut ? "timeout" : "error", status });
      return { error, retryable: !signal.aborted && retryableProviderFailure(error, timedOut) };
    }
  }
  let response = await call(model);
  if ("text" in response) return response.text!;
  if (!response.retryable) throw response.error;
  callbacks.onProgress?.("provider_retry");
  await pause(2_000, signal);
  response = await call(model);
  if ("text" in response) return response.text!;
  if (!response.retryable) throw response.error;
  callbacks.onProgress?.("fallback");
  response = await call(configuredFallbackModel());
  if ("text" in response) return response.text!;
  if (response.retryable) throw new JourneyServiceError("Google is busy right now. Please try again later.");
  throw response.error;
}
