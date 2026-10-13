import "server-only";

export type Timing = { stage: string; attempt: number; duration_ms: number; elapsed_ms: number; outcome: string; query_index?: number; search?: string };
export function generationTelemetry() {
  const started = Date.now();
  const trace_id = crypto.randomUUID();
  const timings: Timing[] = [];
  function record(stage: string, attempt: number, duration_ms: number, detail: { outcome: string; query_index?: number; search?: string; model?: string; provider_attempt?: number; status?: number }) {
    const event = { stage, attempt, duration_ms, elapsed_ms: Date.now() - started, ...detail };
    timings.push(event);
    // Fixed stage names and timings only: never log inputs, prompts, tokens, URLs or keys.
    console.info?.("Journey timing", JSON.stringify({ trace_id, ...event }));
  }
  async function measure<T>(stage: string, attempt: number, operation: () => T | Promise<T>): Promise<T> {
    const began = Date.now();
    try { const result = await operation(); record(stage, attempt, Date.now() - began, { outcome: "success" }); return result; }
    catch (error) { record(stage, attempt, Date.now() - began, { outcome: "error" }); throw error; }
  }
  return { record, measure, result: () => ({ trace_id, total_ms: Date.now() - started, timings }) };
}
