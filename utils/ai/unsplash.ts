import "server-only";
import type { JourneyImage, PhotoCandidate } from "../journeys/types";
import { JourneyServiceError } from "../journeys/validation";

function accessKey() {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new JourneyServiceError("Photo search is not configured.");
  return key;
}
export function validDownloadLocation(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.origin === "https://api.unsplash.com" && /^\/photos\/[A-Za-z0-9_-]+\/download$/.test(url.pathname) &&
      !url.username && !url.password && !url.searchParams.has("client_id");
  } catch { return false; }
}
function photo(value: unknown): PhotoCandidate | null {
  if (!value || typeof value !== "object") return null;
  const p = value as { urls?: { regular?: string }; user?: { name?: string; username?: string }; links?: { download_location?: string } };
  if (!p.urls?.regular || !p.user?.name || !p.user.username || !validDownloadLocation(p.links?.download_location)) return null;
  try { if (new URL(p.urls.regular).origin !== "https://images.unsplash.com") return null; } catch { return null; }
  return { url: p.urls.regular, photographer_name: p.user.name, photographer_username: p.user.username,
    download_location: p.links.download_location };
}
type SearchTiming = { search: string; duration_ms: number; outcome: string };
export async function searchJourneyImages(query: string, signal: AbortSignal, report?: (timing: SearchTiming) => void): Promise<JourneyImage | null> {
  const key = accessKey();
  const initial = await search(query, key, signal, "initial", report);
  if (initial === undefined || initial) return initial ?? null;
  signal.throwIfAborted();
  const broader = `${query.trim().split(/\s+/).slice(-3).join(" ")} New York`;
  return await search(broader, key, signal, "broader", report) ?? null;
}
async function search(query: string, key: string, signal: AbortSignal, search: string, report?: (timing: SearchTiming) => void): Promise<JourneyImage | null | undefined> {
  const started = Date.now();
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(2_000)]);
  let outcome = "error";
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "3");
  url.searchParams.set("content_filter", "high");
  try {
    const response = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      cache: "no-store", redirect: "error", signal: requestSignal });
    // Retry only an empty successful search, not a rate-limit or provider failure.
    if (!response.ok) return undefined;
    const data: { results?: unknown[] } = await response.json();
    const candidates = (data.results ?? []).slice(0, 3).map(photo).filter((p): p is PhotoCandidate => p !== null);
    outcome = candidates.length ? "found" : "empty";
    return candidates.length ? { ...candidates[0], candidates } : null;
  } catch {
    // Missing/error photos become placeholders; provider errors and credentials are never logged.
    outcome = requestSignal.aborted ? "timeout" : "error";
    return undefined;
  } finally { report?.({ search, duration_ms: Date.now() - started, outcome }); }
}
export async function trackPublishedPhoto(downloadLocation: string) {
  if (!validDownloadLocation(downloadLocation)) throw new JourneyServiceError("This photo cannot be tracked for publication.");
  const response = await fetch(downloadLocation, {
    headers: { Authorization: `Client-ID ${accessKey()}`, "Accept-Version": "v1" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new JourneyServiceError("Photo tracking did not finish. Please try another photo or try again later.");
}
