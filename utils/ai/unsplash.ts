import "server-only";
import type { JourneyImage, PhotoCandidate } from "../journeys/types";
import { JourneyServiceError } from "../journeys/validation";
import { readUnsplashPhoto, unsplashResponseMetadata, validDownloadLocation } from "./unsplash-response";
export { validDownloadLocation } from "./unsplash-response";

function accessKey() {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new JourneyServiceError("Photo search is not configured.");
  return key;
}
type SearchTiming = { search: "initial" | "broader" | "publish_tracking"; query: string; result_count: number | null; duration_ms: number; outcome: string; http_status: number | null; rate_limit: number | null; rate_remaining: number | null; created_at: string };
type Reporter = (timing: SearchTiming) => void | Promise<void>;
async function emit(report: Reporter | undefined, timing: SearchTiming) {
  try { await report?.(timing); } catch { /* Logging must not affect search or publication. */ }
}
export async function searchJourneyImages(query: string, signal: AbortSignal, report?: Reporter): Promise<JourneyImage | null> {
  const key = accessKey();
  const initial = await search(query, key, signal, "initial", report);
  if (initial === undefined || initial) return initial ?? null;
  signal.throwIfAborted();
  const broader = `${query.trim().split(/\s+/).slice(-3).join(" ")} New York`;
  return await search(broader, key, signal, "broader", report) ?? null;
}
async function search(query: string, key: string, signal: AbortSignal, search: "initial" | "broader", report?: Reporter): Promise<JourneyImage | null | undefined> {
  const started = Date.now();
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(2_000)]);
  let outcome = "error";
  let result_count: number | null = null;
  let metadata: Pick<SearchTiming, "http_status" | "rate_limit" | "rate_remaining"> = { http_status: null, rate_limit: null, rate_remaining: null };
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "3");
  url.searchParams.set("content_filter", "high");
  try {
    const response = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      cache: "no-store", redirect: "error", signal: requestSignal });
    metadata = unsplashResponseMetadata(response);
    console.info?.("Unsplash HTTP", JSON.stringify({ operation: "search", search, ...metadata }));
    // Retry only an empty successful search, not a rate-limit or provider failure.
    if (!response.ok) return undefined;
    const data: { results?: unknown[] } = await response.json();
    const candidates = (data.results ?? []).slice(0, 3).map(readUnsplashPhoto).filter((p): p is PhotoCandidate => p !== null);
    result_count = candidates.length;
    outcome = candidates.length ? "found" : "empty";
    return candidates.length ? { ...candidates[0], candidates } : null;
  } catch {
    // Missing/error photos become placeholders; provider errors and credentials are never logged.
    outcome = requestSignal.aborted ? "timeout" : "error";
    return undefined;
  } finally { await emit(report, { search, query, result_count, duration_ms: Date.now() - started, outcome, ...metadata, created_at: new Date(started).toISOString() }); }
}
export async function trackPublishedPhoto(downloadLocation: string, report?: Reporter) {
  if (!validDownloadLocation(downloadLocation)) throw new JourneyServiceError("This photo cannot be tracked for publication.");
  const started = Date.now();
  const signal = AbortSignal.timeout(10_000);
  let outcome = "error";
  let metadata = { http_status: null, rate_limit: null, rate_remaining: null } as Pick<SearchTiming, "http_status" | "rate_limit" | "rate_remaining">;
  try {
    const response = await fetch(downloadLocation, {
    headers: { Authorization: `Client-ID ${accessKey()}`, "Accept-Version": "v1" },
    cache: "no-store", redirect: "error", signal,
  });
  metadata = unsplashResponseMetadata(response);
  console.info?.("Unsplash HTTP", JSON.stringify({ operation: "download", ...metadata }));
  if (!response.ok) throw new JourneyServiceError("Photo tracking did not finish. Please try another photo or try again later.");
  outcome = "found";
  } catch (error) { outcome = signal.aborted ? "timeout" : "error"; throw error; }
  finally { await emit(report, { search: "publish_tracking", query: "Published photo download tracking", result_count: null, duration_ms: Date.now() - started, outcome, ...metadata, created_at: new Date(started).toISOString() }); }
}
