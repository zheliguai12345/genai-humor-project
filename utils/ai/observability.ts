import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Redact configured secrets and credential-bearing URLs, including user-supplied text.
// Never persist raw provider exception messages (which can contain request URLs).
export function safeLogText(value: string): string {
  let text = value;
  for (const name of ["GEMINI_API_KEY", "UNSPLASH_ACCESS_KEY", "SUPABASE_SECRET_KEY"]) {
    const secret = process.env[name];
    if (secret) text = text.split(secret).join("[REDACTED]");
  }
  return text.replace(/https?:\/\/[^\s<>"']+/gi, url =>
    /[?&](?:key|api[_-]?key|client_id|access_token|token)=|https?:\/\/[^/]*@/i.test(url) ? "[REDACTED URL]" : url);
}

export async function bestEffort(operation: () => PromiseLike<unknown>) {
  try { await operation(); } catch { /* Observability must never change the business result. */ }
}

export async function writeObservation(client: SupabaseClient, table: "llm_responses" | "image_searches", row: Record<string, unknown>) {
  await bestEffort(async () => {
    const safe = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "string" ? safeLogText(value) : value]));
    const { error } = await client.from(table).insert(safe).abortSignal(AbortSignal.timeout(1_500));
    if (error) console.warn("Observation write failed", { table });
  });
}

export async function promptHash(prompt: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(prompt));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
