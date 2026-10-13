import type { GenerationInput, GenerationProgress } from "./types";
import type { GenerationQuota } from "./presentation";

type Result = { data?: { journey_id: string }; error?: string; quota?: GenerationQuota };
export async function requestGeneration(input: GenerationInput, progress: (event: GenerationProgress) => void, signal: AbortSignal): Promise<Result> {
  const response = await fetch("/api/journeys", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" }, body: JSON.stringify(input), signal });
  if (!response.ok) return await response.json();
  if (!response.body) throw Error("Generation connection unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: Result | undefined;
  function line(text: string) {
    if (!text.trim()) return;
    const event = JSON.parse(text);
    if (event.type === "progress") progress({ stage: event.stage, attempt: event.attempt });
    else if (event.type === "complete") result = { data: event.data };
    else if (event.type === "error") result = { error: event.error, quota: event.quota };
  }
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      lines.forEach(line);
      if (done) { line(buffer); break; }
    }
  } finally { reader.releaseLock(); }
  if (!result) throw Error("Generation connection interrupted.");
  return result;
}
