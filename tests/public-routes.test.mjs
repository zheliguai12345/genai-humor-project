import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

const origin = process.env.AUTH_TEST_ORIGIN ?? "http://127.0.0.1:3001";

test("public home loads, protected pages redirect without content", async () => {
  const home = await fetch(origin);
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /Elsewhere, NYC/);
  assert.match(html, /<span class="wordmark-comma">,<\/span>/);
  assert.match(html, /One city\. A thousand ways to live it\./);
  assert.match(html, /This weekend, live a different story\./);
  assert.match(html, /AI turns real NYC places into a themed day out\./);
  assert.doesNotMatch(html, /Ordinary New York\. Extraordinary premises\./);
  for (const path of ["/rate", "/profile", "/create", "/preview/11111111-1111-4111-8111-111111111111"]) {
    const response = await fetch(origin + path, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location"), origin).pathname, path === "/rate" ? "/" : "/signin");
    assert.doesNotMatch(await response.text(), /Rating interface coming next/);
    assert.match(response.headers.get("cache-control"), /private/);
  }
});

test("callback rejects missing CSRF and missing nonce without establishing a session", async () => {
  for (const cookie of ["", "g_csrf_token=test"]) {
    const form = new URLSearchParams({ credential: "invalid-token", g_csrf_token: "test" });
    const response = await fetch(origin + "/auth/callback", {
      method: "POST", body: form, headers: { cookie }, redirect: "manual",
    });
    assert.equal(response.status, 303);
    assert.equal(new URL(response.headers.get("location"), origin).pathname, "/signin");
    assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /sb-[^;]*auth-token/);
  }
});

test("cross-site nonce requests are denied", async () => {
  const response = await fetch(origin + "/auth/nonce", { headers: { "sec-fetch-site": "cross-site" } });
  assert.equal(response.status, 403);
});

test("login nonce is hashed for Google and retained in a protected callback cookie", async () => {
  const response = await fetch(origin + "/auth/nonce");
  assert.equal(response.status, 200);
  const { nonce } = await response.json();
  const cookie = response.headers.get("set-cookie");
  const original = cookie.match(/humor_login_nonce=([a-f0-9]{64})/)?.[1];
  assert.ok(original);
  assert.ok(nonce === createHash("sha256").update(original).digest("hex"), "nonce hashing matches");
  assert.ok(/HttpOnly/i.test(cookie));
  assert.ok(/Secure/i.test(cookie));
  assert.ok(/SameSite=None/i.test(cookie));
  assert.ok(/Path=\/auth\/callback/i.test(cookie));
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("return cookie preserves a local query, expires after ten minutes, and rejects external next", async () => {
  for (const [next, expected] of [["/?sort=new", "/?sort=new"], ["https://example.com", "/"]]) {
    const response = await fetch(`${origin}/auth/nonce?next=${encodeURIComponent(next)}`);
    const cookie = response.headers.getSetCookie().find(value => value.startsWith("elsewhere_login_return="));
    assert.ok(cookie);
    assert.equal(decodeURIComponent(cookie.split(";")[0].slice("elsewhere_login_return=".length)), expected);
    assert.ok(/Max-Age=600/i.test(cookie));
    assert.ok(/HttpOnly/i.test(cookie) && /Secure/i.test(cookie) && /Path=\/auth\/callback/i.test(cookie));
  }
});
