import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

const origin = process.env.AUTH_TEST_ORIGIN ?? "http://127.0.0.1:3001";

test("public home loads, protected pages redirect without content", async () => {
  const home = await fetch(origin);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /The Humor Project/);
  for (const path of ["/rate", "/profile"]) {
    const response = await fetch(origin + path, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location"), origin).pathname, "/");
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
    assert.equal(new URL(response.headers.get("location"), origin).pathname, "/");
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
  assert.equal(nonce, createHash("sha256").update(original).digest("hex"));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=None/i);
  assert.match(cookie, /Path=\/auth\/callback/i);
  assert.match(response.headers.get("cache-control"), /no-store/);
});
