import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const origin = process.env.AUTH_TEST_ORIGIN ?? 'http://localhost:3001';
const input = { time: 'afternoon', budget: 'under $25', vibes: ['absurd', 'history'], wild_idea: '' };
function post(body = JSON.stringify(input), site = origin) {
  return fetch(origin + '/api/journeys', {
    method: 'POST', headers: { Origin: site, 'Content-Type': 'application/json' }, body,
  });
}

test('anonymous generation and private history requests require authentication', async () => {
  const generation = await post();
  assert.equal(generation.status, 401);
  assert.deepEqual(await generation.json(), { error: 'Sign in to continue.' });
  const history = await fetch(origin + '/api/journeys/generations');
  assert.equal(history.status, 401);
  assert.match(history.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await history.json(), { error: 'Sign in to continue.' });
});

test('cross-origin generation is denied before parsing or provider access', async () => {
  assert.equal((await post('invalid JSON', 'https://untrusted.example')).status, 403);
});

test('generation requests reject invalid JSON and oversized bodies', async () => {
  assert.equal((await post('{')).status, 400);
  assert.equal((await post(JSON.stringify({ wild_idea: 'a'.repeat(4097) }))).status, 413);
});

test('public editorial detail and privacy render; existing private drafts stay inaccessible',async()=>{
  const detail=await fetch(origin+'/journeys/e15e0000-0000-4000-8000-000000000001');
  assert.equal(detail.status,200);
  const html=await detail.text();
  assert.match(html,/The Museum That Doesn/);assert.match(html,/>Maps/);assert.match(html,/Upvote/);assert.doesNotMatch(html,/Would you actually spend a day like this|The route, at a glance/);
  assert.equal((await fetch(origin+'/privacy')).status,200);
  for(const path of ['/journeys/823d4b05-9fd0-4fc2-8adc-32f61adade00','/api/journeys/823d4b05-9fd0-4fc2-8adc-32f61adade00'])assert.equal((await fetch(origin+path)).status,404);
});

test('direct anonymous Journey vote action is denied and cross-origin actions are rejected',async()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../.next/server/server-reference-manifest.json',import.meta.url)));
  const action=Object.entries(manifest.node).find(([,v])=>v.exportedName==='vote')?.[0];
  assert.ok(action,'Build the product first so its vote action is registered.');
  const url=origin+'/journeys/e15e0000-0000-4000-8000-000000000001';
  const body=JSON.stringify(['e15e0000-0000-4000-8000-000000000001','up']);
  const denied=await fetch(url,{method:'POST',headers:{'Next-Action':action,Origin:origin,'Content-Type':'text/plain;charset=UTF-8'},body});
  assert.equal(denied.status,200);assert.match(await denied.text(),/Sign in to continue/);
  const cross=await fetch(url,{method:'POST',headers:{'Next-Action':action,Origin:'https://untrusted.example','Content-Type':'text/plain;charset=UTF-8'},body});
  assert.ok(cross.status>=400);
});

test('anonymous streaming generation is denied before quota, model, or private progress',async()=>{
  const response=await fetch(origin+'/api/journeys',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify(input)});
  assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'Sign in to continue.'});
});
