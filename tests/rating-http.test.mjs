import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const origin = process.env.AUTH_TEST_ORIGIN ?? 'http://localhost:3001';
const manifest = process.env.RATE_TEST_ACTION_ID ? null : JSON.parse(fs.readFileSync(new URL('../.next/server/server-reference-manifest.json', import.meta.url)));
const action = process.env.RATE_TEST_ACTION_ID ?? Object.entries(manifest.node).find(([, value]) => value.exportedName === 'submitVote')?.[0];
assert.ok(action, 'Build the app first or supply its deployed RATE_TEST_ACTION_ID.');

function body() {
  const data = new FormData();
  data.set('0', '[{},"$K1"]');
  data.set('1_caption_id', '11111111-1111-4111-8111-111111111111');
  data.set('1_vote', 'up');
  return data;
}

test('direct unauthenticated vote POST is rejected by the action itself', async () => {
  const response = await fetch(origin + '/rate', {
    method: 'POST', headers: { 'Next-Action': action, Origin: origin }, body: body(),
  });
  assert.equal(response.status, 200);
  const content = await response.text();
  assert.match(content, /Sign in to rate captions/);
  assert.doesNotMatch(content, /"saved"/);
});

test('cross-origin vote POST is rejected by Server Action CSRF protection', async () => {
  const response = await fetch(origin + '/rate', {
    method: 'POST', headers: { 'Next-Action': action, Origin: 'https://untrusted.example' }, body: body(),
  });
  assert.ok(response.status >= 400);
  assert.doesNotMatch(await response.text(), /"saved"/);
});
