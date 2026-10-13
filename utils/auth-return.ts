// Shared browser/server validation. Never turn an untrusted return path into an origin.
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 1024 || !value.startsWith("/")) return "/";
  let decoded = value;
  try {
    for (let depth = 0; depth < 5; depth++) {
      if (decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return "/";
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    const origin = "https://elsewhere.invalid";
    const url = new URL(value, origin);
    if (url.origin !== origin || url.pathname.startsWith("//") || url.pathname === "/signin") return "/";
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path.length <= 1024 ? path : "/";
  } catch { return "/"; }
}
