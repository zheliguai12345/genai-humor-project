import { timingSafeEqual } from "node:crypto";

export const LOGIN_NONCE_COOKIE = "humor_login_nonce";
export const LOGIN_RETURN_COOKIE = "elsewhere_login_return";
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  return /^(?:\/|\/create|\/profile|\/(?:journeys|preview)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:#vote)?$/i.test(value) ? value : "/";
}

export function matchingCsrf(cookie: string | undefined, submitted: FormDataEntryValue | null) {
  if (!cookie || typeof submitted !== "string" || !submitted) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(submitted);
  return a.length === b.length && timingSafeEqual(a, b);
}
