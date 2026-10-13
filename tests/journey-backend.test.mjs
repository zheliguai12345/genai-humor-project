import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { moduleLoader } from './helpers/module-loader.mjs';

const root = path.resolve(import.meta.dirname, '..');
const uid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const draftId = '33333333-3333-4333-8333-333333333333';
const otherDraft = '44444444-4444-4444-8444-444444444444';
const publishedId = '55555555-5555-4555-8555-555555555555';
const input = { time: 'afternoon', budget: 'under $25', vibes: ['absurd', 'history'], wild_idea: '' };
const samples = JSON.parse(fs.readFileSync(path.join(root, 'utils/journeys/editorial-samples.json')));
function output() {
  const { slug, cover_image, stops, ...journey } = samples[0];
  void slug; void cover_image;
  return { ...journey, cover_image_query: 'SoHo shadows New York', stops: stops.map(({ image, position, ...stop }) => {
    void image; void position;
    return { ...stop, image_query: 'street shadows New York' };
  }) };
}
const image = { url: 'https://images.unsplash.com/photo-test?ixid=provided', photographer_name: 'Photographer',
  photographer_username: 'photographer', download_location: 'https://api.unsplash.com/photos/test/download', candidates: [] };
image.candidates = [{ ...image, candidates: undefined }];


async function backend({ signedIn = true, responses = [JSON.stringify(output())], quota = false, trackingFails = false, lostSaveResponse = false, fallbackModel = false, photoControl } = {}) {
  const events = [], writes = [], warnings = [], votes = new Map();
  let modelCalls = 0;
  const rows = {
    journeys: [{ id: draftId, author_id: uid, is_editorial:false, status: 'draft', cover_image: image },
      { id: otherDraft, author_id: other, is_editorial:false, status: 'draft', cover_image: image },
      { id: publishedId, author_id: other, is_editorial:false, status: 'published', cover_image: image }],
    journey_stops: [1, 2, 3].map(position => ({ journey_id: draftId, position, image })),
    generation_runs: [{ id: 'own-run', user_id: uid }, { id: 'private-run', user_id: other }], journey_votes: [],
  };
  const db = {
    from(table) {
      const filters = []; let update, deletion=false, interval, countRequested=false, head=false;
      const query = {
        select(_fields,options={}) { countRequested=options.count==='exact';head=!!options.head;return this; }, order() { return this; }, limit() { return this; },
        range(start,end){interval=[start,end];return this;},
        in(key,values){filters.push([key,{values}]);return this;},
        gte(key,value){filters.push([key,{minimum:value}]);return this;},
        abortSignal(signal) { assert.ok(signal); return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        update(value) { update = value; return this; },
        delete() { deletion=true; return this; },
        async maybeSingle() { const data = await this; return { ...data, data: data.data[0] ?? null }; },
        then(resolve, reject) {
          events.push({ table, filters });
          let data = rows[table]?.filter(row => filters.every(([key, value]) => {
            const actual=key.split('.').reduce((v,k)=>v?.[k],row);
            return value?.values ? value.values.includes(actual) : value?.minimum ? actual>=value.minimum : actual===value;
          })) ?? [];
          const count=data.length;
          if (update) { writes.push({ table, filters, update }); for (const row of data) Object.assign(row, update); }
          if(deletion){writes.push({table,filters,delete:true});rows[table]=rows[table].filter(row=>!data.includes(row));for(const row of data)votes.delete(`${row.journey_id}:${row.user_id}`);}
          if(interval)data=data.slice(interval[0],interval[1]+1);
          return Promise.resolve({ data:head?null:data, count:countRequested?count:null, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    rpc(name, args) {
      const result = this.rpcResult(name, args);
      result.abortSignal = signal => { assert.ok(signal); return result; };
      return result;
    },
    async rpcResult(name, args) {
      events.push({ rpc: name, args });
      assert.equal(args.p_user_id, uid, 'every RPC must derive identity from validated Auth');
      if (name === 'reserve_journey_generation') {
        if (quota) return { data: null, error: { message: 'daily_generation_limit' } };
        const id = `run-${rows.generation_runs.length}`;
        rows.generation_runs.push({ id, user_id: uid, ...args, status: 'failed' });
        return { data: id, error: null };
      }
      if (name === 'save_generated_journey') {
        const run = rows.generation_runs.find(r => r.id === args.p_run_id);
        Object.assign(run, { status: 'success', journey_id: draftId });
        return lostSaveResponse ? { data: null, error: { message: 'Network response interrupted after commit' } }
          : { data: draftId, error: null };
      }
      if (name === 'vote_on_journey') {
        if (!rows.journeys.some(j => j.id === args.p_journey_id && j.status === 'published')) return { error: { message: 'published_journey_not_found' } };
        votes.set(`${args.p_journey_id}:${args.p_user_id}`, args.p_value);
        const existing=rows.journey_votes.find(row=>row.journey_id===args.p_journey_id&&row.user_id===args.p_user_id);
        if(existing)existing.value=args.p_value;else rows.journey_votes.push({journey_id:args.p_journey_id,user_id:args.p_user_id,value:args.p_value});
        return { error: null };
      }
      if (name === 'publish_journey') {
        const target = rows.journeys.find(j => j.id === args.p_journey_id && j.author_id === uid && j.status === 'draft');
        if (!target) return { error: { message: 'draft_not_found' } };
        const selected = [];
        for (const entry of args.p_selection) {
          const stored = entry.position === 0 ? target.cover_image : rows.journey_stops.find(s => s.journey_id === target.id && s.position === entry.position)?.image;
          if (!stored?.candidates[entry.candidate_index]) return { error: { message: 'invalid_candidate_index' } };
          selected.push({ position: entry.position, image: { ...stored.candidates[entry.candidate_index], candidates: stored.candidates } });
        }
        target.status = 'published';
        return { data: selected, error: null };
      }
      throw Error('Unexpected RPC');
    },
  };
  const api = await moduleLoader('utils/supabase/journeys.ts', {
    console: { warn: (...args) => warnings.push(args) },
    './server': { createClient: async () => ({ auth: { getUser: async () => {
      events.push('getUser'); return { data: { user: signedIn ? { id: uid } : null }, error: null };
    } } }) },
    '@supabase/supabase-js': { createClient: () => { events.push('privileged'); return db; } },
    '../ai/gemini': { configuredModel: () => 'isolated-model', generateJourneyText: async (_system,_prompt,_model,_signal,callbacks) => {
      callbacks?.onModelUsed?.(fallbackModel?"isolated-fallback":"isolated-model");
      events.push('model'); const raw = responses[Math.min(modelCalls++, responses.length - 1)];
      if (raw instanceof Error) throw raw;
      return raw;
    } },
    '../ai/unsplash': { searchJourneyImages: async () => { events.push('photo-search'); if(photoControl)await photoControl; return null; },
      trackPublishedPhoto: async () => { events.push('download'); if (trackingFails) throw Error('provider failure'); } },
  });
  return { api, events, writes, warnings, votes, rows, calls: () => modelCalls };
}

test('anonymous users cannot generate, publish, vote, or read drafts/history; no privileged client or API is used', async () => {
  const b = await backend({ signedIn: false });
  for (const action of [() => b.api.generateJourney(input), () => b.api.publishJourney(draftId, []),
    () => b.api.voteOnJourney(publishedId, 'up'), () => b.api.getOwnDraft(otherDraft), () => b.api.getOwnGenerationRuns(),
    () => b.api.getOwnJourneys(),()=>b.api.getGenerationQuota()]) {
    await assert.rejects(action(), /Sign in/);
  }
  assert.ok(b.events.every(event => event === 'getUser'));
  assert.equal(b.calls(), 0);
});

test('Top uses net score across all published vote pages; New uses publication time and excludes drafts',async()=>{
  const b=await backend();const editorialId='66666666-6666-4666-8666-666666666666',newId='77777777-7777-4777-8777-777777777777';
  b.rows.journeys.find(j=>j.id===publishedId).published_at='2026-10-11';
  b.rows.journeys.push({id:editorialId,is_editorial:true,status:'published',published_at:'2026-10-12'},
    {id:newId,status:'published',published_at:'2026-10-13'});
  b.rows.journey_votes.push(...Array.from({length:601},()=>({journey_id:publishedId,value:'up',journeys:{status:'published'}})),
    ...Array.from({length:700},()=>({journey_id:publishedId,value:'down',journeys:{status:'published'}})),
    ...Array.from({length:2},()=>({journey_id:editorialId,value:'up',journeys:{status:'published'}})),
    ...Array.from({length:700},()=>({journey_id:draftId,value:'up',journeys:{status:'draft'}})));
  const feed=await b.api.getDiscoverJourneys('top');
  assert.equal(feed.counts[publishedId].up,601);assert.equal(feed.counts[draftId],undefined);
  assert.deepEqual(Array.from(feed.journeys,j=>j.id),[editorialId,newId,publishedId]);
  assert.equal(b.events.filter(e=>e.table==='journey_votes').length,3);
  assert.deepEqual(Array.from((await b.api.getDiscoverJourneys('new')).journeys,j=>j.id),[newId,editorialId,publishedId]);
});

test('quota and Your journeys only read the authenticated user; draft vote totals remain private',async()=>{
  const b=await backend();const now=new Date().toISOString();
  b.rows.generation_runs.push({id:'today-own',user_id:uid,created_at:now},{id:'today-other',user_id:other,created_at:now});
  const quota=await b.api.getGenerationQuota();assert.equal(quota.used,1);assert.equal(quota.remaining,9);
  const own=await b.api.getOwnJourneys();assert.ok(own.every(j=>j.author_id===uid));
  b.rows.journey_votes.push({journey_id:publishedId,value:'up'},{journey_id:publishedId,value:'down'},{journey_id:publishedId,value:'up'});
  assert.equal((await b.api.getJourneyVoteCounts(publishedId)).up,2);
  assert.equal((await b.api.getJourneyVoteCounts(draftId)).up,0);
});

test('public reads exclude drafts, and private reads cannot return another user’s draft or generation records', async () => {
  const b = await backend();
  assert.equal(await b.api.getPublishedJourney(draftId), null);
  assert.equal((await b.api.getPublishedJourneys()).length, 1);
  assert.equal(await b.api.getOwnDraft(otherDraft), null);
  const runs = await b.api.getOwnGenerationRuns();
  assert.equal(runs.length, 1); assert.equal(runs[0].user_id, uid);
  assert.ok(!b.events.some(e => e.table === 'journey_stops'), 'unavailable drafts must never load stops');
});

test('a non-owner cannot publish or trigger any Unsplash download', async () => {
  const b = await backend();
  await assert.rejects(b.api.publishJourney(otherDraft, []), /not available/);
  assert.ok(!b.events.includes('download'));
  assert.ok(!b.events.some(e => e.rpc === 'publish_journey'));
});

test('draft voting is rejected and repeated published votes update the same authenticated association', async () => {
  const b = await backend();
  await assert.rejects(b.api.voteOnJourney(draftId, 'up'), /not available/);
  await b.api.voteOnJourney(publishedId, 'up'); await b.api.voteOnJourney(publishedId, 'down');
  assert.equal(b.votes.size, 1); assert.equal(b.votes.get(`${publishedId}:${uid}`), 'down');
  await assert.rejects(b.api.voteOnJourney(publishedId, 'sideways'), /Choose/);
});

test('quota denial happens before paid API access', async () => {
  const b = await backend({ quota: true });
  await assert.rejects(b.api.generateJourney(input), /10-generation limit/);
  assert.equal(b.calls(), 0); assert.ok(!b.events.includes('photo-search'));
});

test('invalid input cannot consume quota or call the model', async () => {
  const b = await backend();
  for (const bad of [{ ...input, time: 'midnight' }, { ...input, vibes: ['bogus'] }, { ...input, wild_idea: 'x'.repeat(201) }]) {
    await assert.rejects(b.api.generateJourney(bad), /Choose|200/);
  }
  assert.equal(b.calls(), 0); assert.ok(!b.events.some(e => e.rpc));
});

test('validation correction shares one quota reservation, retains prior output, and saves only a draft', async () => {
  const b = await backend({ responses: ['invalid JSON', JSON.stringify(output())] });
  const result = await b.api.generateJourney({ ...input, user_id: other });
  assert.equal(b.calls(), 2); assert.equal(result.journey_id, draftId);
  const reservations = b.events.filter(e => e.rpc === 'reserve_journey_generation');
  assert.equal(reservations.length, 1);
  assert.match(b.rows.generation_runs.at(-1).user_prompt, /failed validation/);
  assert.equal(b.rows.generation_runs.at(-1).input.validation_history[0].raw_output,"invalid JSON");
  assert.ok(b.writes.some(w => w.update.raw_output === 'invalid JSON' && w.update.status === 'failed'));
  const save = b.events.find(e => e.rpc === 'save_generated_journey');
  assert.equal(save.args.p_user_id, uid);
  assert.equal(save.args.p_journey.status, undefined, 'caller cannot choose published status');
  assert.equal(save.args.p_journey.cover_image, null);
  assert.equal(save.args.p_journey.stops.length, 5);
  assert.equal(b.rows.generation_runs.at(-1).status, 'success');
  assert.ok(reservations[0].args.p_system_prompt.includes('EDITORIAL JSON EXAMPLES'));
});

test('persistent invalid output stops after two corrections; exhausted provider failures do not restart generation or expose details', async () => {
  const invalid = await backend({ responses: ['{}'] });
  await assert.rejects(invalid.api.generateJourney(input), /different idea/);
  assert.equal(invalid.calls(), 2); assert.ok(!invalid.events.some(e => e.rpc === 'save_generated_journey'));
  const failing = await backend({ responses: [Error('sensitive-provider-detail')] });
  await assert.rejects(failing.api.generateJourney(input), /couldn't complete/);
  assert.equal(failing.calls(), 1);
  assert.ok(failing.writes.some(w => w.update.status === 'failed' && w.update.raw_output === null));
  assert.ok(failing.writes.every(w => !JSON.stringify(w).includes('sensitive-provider-detail')));
});

test('a lost draft-save response cannot overwrite a committed successful run or trigger another model call', async () => {
  const b = await backend({ lostSaveResponse: true });
  await assert.rejects(b.api.generateJourney(input), /couldn't confirm/);
  assert.equal(b.calls(), 1);
  assert.equal(b.rows.generation_runs.at(-1).status, 'success');
  assert.equal(b.rows.generation_runs.at(-1).journey_id, draftId);
});

test('publication sends only indices to the transaction, then tracks the committed stored photos', async () => {
  const b = await backend();
  await b.api.publishJourney(draftId, [0,1,2,3].map(position => ({ position, candidate_index: 0 })));
  assert.equal(b.events.filter(e => e === 'download').length, 4);
  const publish = b.events.find(e => e.rpc === 'publish_journey');
  assert.ok(publish.args.p_selection.every(s => Object.keys(s).sort().join(',') === 'candidate_index,position'));
  assert.ok(b.events.indexOf(publish) < b.events.indexOf('download'));
  assert.equal(b.rows.journeys.find(j => j.id === draftId).status, 'published');
});

test('tracking failures only produce safe logs; invalid selections cannot publish', async () => {
  const b = await backend({ trackingFails: true });
  assert.equal((await b.api.publishJourney(draftId, [0,1,2,3].map(position => ({position,candidate_index:0})))).journey_id, draftId);
  assert.equal(b.rows.journeys.find(j => j.id === draftId).status, 'published');
  assert.equal(b.warnings.length, 4);
  assert.doesNotMatch(JSON.stringify(b.warnings), /provider failure|https|isolated-test/);
  const invalid = await backend();
  for (const selections of [[0,1,1,3].map(position => ({position,candidate_index:0})),
    [0,1,2].map(position => ({position,candidate_index:0})),
    [0,1,2,3].map(position => ({position,candidate_index:0,url:'https://attacker.test'}))]) {
    await assert.rejects(invalid.api.publishJourney(draftId, selections), /photo/);
  }
  assert.ok(!invalid.events.some(e => e.rpc === 'publish_journey'));
  await assert.rejects(invalid.api.publishJourney(draftId, [0,1,2,3].map(position => ({position,candidate_index:2}))), /photo selections/);
  assert.ok(!invalid.events.includes('download'));
  assert.equal(invalid.rows.journeys.find(j => j.id === draftId).status, 'draft');
});

test('output validation enforces required fields, sizes, stop counts, and photographable query lengths', async () => {
  const api = await moduleLoader('utils/journeys/validation.ts');
  assert.equal(api.validateOutput(JSON.stringify(output())).stops.length, 5);
  for (const bad of [{ ...output(), stops: [] }, { ...output(), title: 'x'.repeat(161) },
    { ...output(), title: '' }, { ...output(), cover_image_query: 'NYC' }]) {
    assert.throws(() => api.validateOutput(JSON.stringify(bad)));
  }
  const longQuery = { ...output(), cover_image_query:'beautiful small ordinary wooden shop window in New York' };
  const normalized = api.validateOutput(JSON.stringify(longQuery));
  assert.equal(normalized.cover_image_query,'beautiful small ordinary wooden shop window');
});

test('Gemini SDK uses a 90s total ceiling and low thinking, JSON schema, configured model, and no implicit transport retries', async () => {
  let config, request;
  const api = await moduleLoader('utils/ai/gemini.ts', { '@google/genai': { ThinkingLevel:{LOW:'LOW',MINIMAL:'MINIMAL'},GoogleGenAI: class {
    constructor(options) { config = options; }
    models = { generateContent: async params => { request = params; return { text: 'raw' }; } };
  } } });
  assert.equal(await api.generateJourneyText('system', 'user', api.configuredModel(), AbortSignal.timeout(60000)), 'raw');
  assert.equal(config.httpOptions.timeout, 90000); assert.equal(config.httpOptions.retryOptions.attempts, 1);
  assert.equal(request.config.thinkingConfig.thinkingLevel,'LOW');assert.equal(request.model, 'isolated-model'); assert.equal(request.config.responseMimeType, 'application/json');
  assert.equal(request.config.responseJsonSchema.properties.stops.maxItems, 5);
});

test('Unsplash preserves API URLs, takes first three photos, and rejects download SSRF', async () => {
  const calls = [];
  const api = await moduleLoader('utils/ai/unsplash.ts', { fetch: async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, json: async () => ({ results: Array.from({length:4}, (_,i) => ({
      urls:{regular:`https://images.unsplash.com/photo-${i}?ixid=original`}, user:{name:'Name',username:'name'}, links:{download_location:`https://api.unsplash.com/photos/id${i}/download`},
    })) }) };
  } });
  const result = await api.searchJourneyImages('New York street', AbortSignal.timeout(1000));
  assert.equal(result.candidates.length, 3); assert.equal(result.url, 'https://images.unsplash.com/photo-0?ixid=original');
  assert.equal(new URL(calls[0].url).searchParams.get('per_page'), '3');
  for (const bad of ['https://attacker.test/photos/id/download', 'https://api.unsplash.com@attacker.test/photos/id/download', 'http://api.unsplash.com/photos/id/download']) {
    await assert.rejects(api.trackPublishedPhoto(bad), /cannot be tracked/);
  }
  assert.equal(calls.length, 1);
  await api.trackPublishedPhoto(result.download_location);
  assert.equal(calls.length, 2); assert.equal(calls[1].options.redirect, 'error');
});

test('an empty photo search broadens once; provider errors do not produce repeat requests', async () => {
  const queries=[];
  const empty=await moduleLoader('utils/ai/unsplash.ts',{fetch:async url=>{
    queries.push(new URL(url).searchParams.get('query'));
    return {ok:true,json:async()=>({results:[]})};
  }});
  assert.equal(await empty.searchJourneyImages('ordinary neon diner window reflections',AbortSignal.timeout(1000)),null);
  assert.deepEqual(queries,['ordinary neon diner window reflections','diner window reflections New York']);
  let calls=0;
  const limited=await moduleLoader('utils/ai/unsplash.ts',{fetch:async()=>{calls++;return {ok:false,status:429};}});
  assert.equal(await limited.searchJourneyImages('ordinary New York street',AbortSignal.timeout(1000)),null);
  assert.equal(calls,1);
});

test('requested physical-action and neighborhood quality rules appear verbatim in the system prompt', async () => {
  const prompt=await moduleLoader('utils/ai/journey-prompt.ts');
  for(const sentence of ['- A move is something the body does: walk, touch, count, order, sit, stand, look up, listen, mail, trade. Never "write down", "note", "think about", "ask yourself", "reflect", "imagine", or "consider".',
    '- Choose places a student would not already plan to visit. Avoid churches, museums, and landmarks unless the premise cannot work without one, and never more than one per journey.',
    '- Vary neighborhoods. Do not default to Lower Manhattan, Times Square, or Midtown.',
    '- If you are not certain of a date, a sequence of events, or a cause and effect, leave it out. A vivid true detail is better than a dramatic uncertain one.']) assert.ok(prompt.SYSTEM_PROMPT.includes(sentence));
});

test('migration seeds match the maintained editorial copy and enable RLS without touching tasks', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202610120001_elsewhere_journeys.sql'), 'utf8');
  const seededStops = [...sql.matchAll(/jsonb_to_recordset\('((?:''|[^'])*)'::jsonb\)/g)]
    .map(match => JSON.parse(match[1].replace(/''/g, "'")));
  assert.equal(samples.length, 4); assert.equal(seededStops.length, samples.length);
  const copy = stops => stops.map(({ position, time_label, title, place, body, move }) => ({ position, time_label, title, place, body, move }));
  samples.forEach((sample, i) => {
    for (const field of ['title', 'hook', 'premise', 'ending']) assert.ok(sql.includes(sample[field].replace(/'/g, "''")));
    assert.deepEqual(copy(seededStops[i]), copy(sample.stops));
  });
  for (const table of ['journeys','journey_stops','generation_runs','journey_votes','profiles','captions','caption_votes']) {
    assert.ok(sql.includes(`alter table public.${table} enable row level security;`));
  }
  assert.doesNotMatch(sql, /(?:alter|update|delete from|insert into)\s+(?:table\s+)?public\.tasks/i);
  assert.match(sql, /pg_advisory_xact_lock/); assert.match(sql, /on conflict\(journey_id,user_id\) do update/);
  assert.doesNotMatch(sql, /publish_token|publish_downloads|claim_journey_publish|record_journey_download|finish_journey_publish/);
  assert.match(sql, /public\.publish_journey\(p_user_id uuid,p_journey_id uuid,p_selection jsonb\)/);
});

test('vote → cancel → vote deletes only the authenticated user row, even with a forged extra identity',async()=>{
  const b=await backend();
  b.rows.journey_votes.push({journey_id:publishedId,user_id:other,value:'down'});
  await b.api.voteOnJourney(publishedId,'up');
  await b.api.voteOnJourney(publishedId,null,other);
  assert.equal(b.rows.journey_votes.length,1);assert.equal(b.rows.journey_votes[0].user_id,other);
  assert.equal(b.votes.has(`${publishedId}:${uid}`),false);
  const deletion=b.writes.find(w=>w.delete);
  assert.deepEqual(deletion.filters,[['journey_id',publishedId],['user_id',uid]]);
  await b.api.voteOnJourney(publishedId,'down');
  assert.equal(b.rows.journey_votes.length,2);assert.equal(b.votes.get(`${publishedId}:${uid}`),'down');
  await assert.rejects(b.api.voteOnJourney(draftId,null),/not available/);
  await assert.rejects((await backend({signedIn:false})).api.voteOnJourney(publishedId,null),/Sign in/);
});
test('own card votes are read with authenticated identity and actual fallback model is persisted in the same run',async()=>{
  const b=await backend({fallbackModel:true});
  b.rows.journey_votes.push({journey_id:publishedId,user_id:uid,value:'up'},{journey_id:publishedId,user_id:other,value:'down'});
  assert.equal((await b.api.getOwnJourneyVotes([publishedId]))[publishedId],'up');
  await b.api.generateJourney(input);
  assert.equal(b.rows.generation_runs.at(-1).model,'isolated-fallback');
  assert.equal(b.events.filter(e=>e.rpc==='reserve_journey_generation').length,1);
});

test('unique photograph searches start together, rather than waiting for each other',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  const b=await backend({photoControl:gate});const job=b.api.generateJourney(input);
  await new Promise(resolve=>setTimeout(resolve,50));
  try{assert.equal(b.events.filter(e=>e==='photo-search').length,2);}finally{release();}
  await job;
});
test('an Unsplash timeout becomes null after one short request and does not trigger a second search',async()=>{
  let calls=0;const timings=[];
  const api=await moduleLoader('utils/ai/unsplash.ts',{fetch:async(_url,options)=>{calls++;return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));}});
  const start=Date.now();
  assert.equal(await api.searchJourneyImages('New York empty street',AbortSignal.timeout(10_000),event=>timings.push(event)),null);
  assert.equal(calls,1);assert.equal(timings[0].outcome,'timeout');assert.ok(Date.now()-start<3500);
});
