import type { PhotoCandidate } from "../journeys/types";

export function validDownloadLocation(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.origin === "https://api.unsplash.com" && /^\/photos\/[A-Za-z0-9_-]+\/download$/.test(url.pathname) &&
      !url.username && !url.password && !url.searchParams.has("client_id");
  } catch { return false; }
}
export function readUnsplashPhoto(value: unknown): PhotoCandidate | null {
  if (!value || typeof value !== "object") return null;
  const p = value as { urls?: { regular?: string }; user?: { name?: string; username?: string }; links?: { download_location?: string } };
  if (!p.urls?.regular || !p.user?.name || !p.user.username || !validDownloadLocation(p.links?.download_location)) return null;
  try {
    const url = new URL(p.urls.regular);
    if (url.origin !== "https://images.unsplash.com" || url.username || url.password) return null;
  } catch { return null; }
  return { url: p.urls.regular, photographer_name: p.user.name, photographer_username: p.user.username,
    download_location: p.links.download_location };
}
export function unsplashResponseMetadata(response: { status: number; headers?: { get(name: string): string | null } }) {
  const count = (name: string) => {
    const value = response.headers?.get(name);
    return value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  };
  return { http_status: Number.isInteger(response.status) ? response.status : null,
    rate_limit: count("X-Ratelimit-Limit"), rate_remaining: count("X-Ratelimit-Remaining") };
}
