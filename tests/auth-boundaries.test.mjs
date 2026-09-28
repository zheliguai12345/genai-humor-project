import assert from "node:assert/strict";
import test from "node:test";
import { matchingCsrf } from "../utils/auth-validation.ts";
import { avatarExtension } from "../utils/avatar-validation.ts";
import { needsNames } from "../utils/profile.ts";

test("callback rejects missing, mismatched, and non-string CSRF tokens", () => {
  assert.equal(matchingCsrf(undefined, "token"), false);
  assert.equal(matchingCsrf("token", null), false);
  assert.equal(matchingCsrf("token", "wrong"), false);
  assert.equal(matchingCsrf("token", new File(["token"], "token")), false);
  assert.equal(matchingCsrf("token", "token"), true);
  // Equal character lengths need not have equal UTF-8 byte lengths.
  assert.equal(matchingCsrf("é", "a"), false);
});

test("avatar type cannot be asserted just by a filename or MIME type", () => {
  const html = new TextEncoder().encode("<script>alert(1)</script>");
  assert.equal(avatarExtension(html, "image/png"), null);
  assert.equal(avatarExtension(new Uint8Array(), "image/jpeg"), null);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(avatarExtension(png, "image/png"), "png");
  assert.equal(avatarExtension(png, "image/jpeg"), null);
  assert.equal(avatarExtension(png, "image/svg+xml"), null);
  assert.equal(avatarExtension(new Uint8Array([255, 216, 255]), "image/jpeg"), "jpg");
  assert.equal(avatarExtension(new TextEncoder().encode("RIFF0000WEBP"), "image/webp"), "webp");
});

test("one missing or whitespace-only name still requires completion", () => {
  const profile = { id: "test", first_name: "Ada", last_name: "Lovelace", avatar_path: null };
  assert.equal(needsNames(profile), false);
  assert.equal(needsNames({ ...profile, first_name: null }), true);
  assert.equal(needsNames({ ...profile, last_name: "  " }), true);
});
