import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const captionId = '30952895-4e16-4266-aff2-dde6ea793ed0';
const userId = '11111111-1111-4111-8111-111111111111';

// Execute the actual server module with isolated Auth/database dependencies.
// No real credentials or session capture are used for negative-path tests.
async function rating({ signedIn = true, exists = true, databaseError = false } = {}) {
  const calls = [];
  const inserts = [];
  const context = vm.createContext({ process: { env: { SUPABASE_SECRET_KEY: 'isolated-test' } } });
  const db = {
    from(table) {
      calls.push(table);
      if (table === 'caption_votes') return {
        async insert(row) { inserts.push(row); return { error: databaseError ? new Error('failed') : null }; },
      };
      assert.equal(table, 'captions');
      return { select() { return { eq(_column, id) { return {
        async maybeSingle() { return { data: exists ? { id } : null, error: null }; },
      }; } }; } };
    },
  };
  const dependencies = {
    'server-only': {},
    './server': { createClient: async () => ({ auth: { getUser: async () => {
      calls.push('getUser');
      return { data: { user: signedIn ? { id: userId } : null }, error: null };
    } } }) },
    '@supabase/supabase-js': { createClient: () => {
      assert.equal(calls.at(-1), 'getUser');
      calls.push('privileged');
      return db;
    } },
  };
  const source = ts.transpileModule(fs.readFileSync(new URL('../utils/supabase/rating.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const ratingModule = new vm.SourceTextModule(source, { context });
  await ratingModule.link(specifier => {
    const exports = dependencies[specifier];
    assert.ok(exports, `Unexpected import: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(exports), function() {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
  });
  await ratingModule.evaluate();
  return { api: ratingModule.namespace, calls, inserts };
}

function form(id = captionId, vote = 'up') {
  const data = new FormData();
  data.set('caption_id', id);
  data.set('vote', vote);
  return data;
}

test('unauthenticated mutation and reads never create a privileged client', async () => {
  const { api, calls, inserts } = await rating({ signedIn: false });
  assert.equal((await api.insertCaptionVote(form())).authenticated, false);
  await assert.rejects(api.getRatingCaptions(), /Sign in/);
  assert.ok(calls.every(call => call === 'getUser'));
  assert.equal(inserts.length, 0);
});

test('malformed IDs and invalid vote values are rejected before database access', async () => {
  for (const [id, vote] of [['not-a-uuid', 'up'], [captionId, 'sideways']]) {
    const { api, calls, inserts } = await rating();
    await assert.rejects(api.insertCaptionVote(form(id, vote)), /Choose/);
    assert.deepEqual(calls, ['getUser']);
    assert.equal(inserts.length, 0);
  }
});

test('a valid UUID for a missing caption is rejected without INSERT', async () => {
  const { api, inserts } = await rating({ exists: false });
  await assert.rejects(api.insertCaptionVote(form()), /no longer available/);
  assert.equal(inserts.length, 0);
});

test('client identity is ignored and each up/down submission INSERTs a new row', async () => {
  const { api, calls, inserts } = await rating();
  for (const vote of ['up', 'down', 'up']) {
    const data = form(captionId, vote);
    data.set('user_id', '22222222-2222-4222-8222-222222222222');
    assert.equal((await api.insertCaptionVote(data)).vote, vote);
  }
  assert.equal(calls.filter(call => call === 'getUser').length, 3);
  assert.deepEqual(inserts.map(row => ({ ...row })), ['up', 'down', 'up'].map(vote => ({ caption_id: captionId, user_id: userId, vote })));
});

test('database failure cannot return a saved result', async () => {
  const { api } = await rating({ databaseError: true });
  await assert.rejects(api.insertCaptionVote(form()), /Unable to save/);
});
