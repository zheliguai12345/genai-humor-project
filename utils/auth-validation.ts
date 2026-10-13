import { timingSafeEqual } from "node:crypto";

export const LOGIN_NONCE_COOKIE = "humor_login_nonce";
export const LOGIN_RETURN_COOKIE = "elsewhere_login_return";

export function matchingCsrf(cookie: string | undefined, submitted: FormDataEntryValue | null) {
  if (!cookie || typeof submitted !== "string" || !submitted) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(submitted);
  return a.length === b.length && timingSafeEqual(a, b);
}
