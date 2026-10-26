import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/module-loader.mjs';

test('best-effort writes redact configured secrets and credential URLs, use an independent timeout, and swallow all storage failures',async()=>{
 const writes=[],warnings=[];
 const log=await moduleLoader('utils/ai/observability.ts',{console:{warn:(...args)=>warnings.push(args)}},{GEMINI_API_KEY:'private-key',UNSPLASH_ACCESS_KEY:'private-photo',SUPABASE_SECRET_KEY:'private-db'});
 const client={from(table){return{insert(row){writes.push({table,row});return{abortSignal(signal){assert.equal(signal.aborted,false);return Promise.resolve({error:{message:'private-key'}});}};}};}};
 await log.writeObservation(client,'llm_responses',{user_prompt:'private-key https://a.test/path?key=private-key',response_output:'private-photo private-db',status:'success'});
 assert.equal(writes.length,1);assert.equal(writes[0].row.user_prompt,'[REDACTED] [REDACTED URL]');
 assert.equal(writes[0].row.response_output,'[REDACTED] [REDACTED]');assert.equal(JSON.stringify(warnings).includes('private-key'),false);
 await assert.doesNotReject(log.writeObservation({from(){throw Error('connection failed');}},'image_searches',{}));
 await assert.doesNotReject(log.writeObservation({from(){return{insert(){return{abortSignal(){return Promise.reject(Error('timeout'));}};}};}},'llm_responses',{}));
 await assert.doesNotReject(log.bestEffort(()=>{throw Error('synchronous callback');}));
 assert.equal(await log.promptHash('system'),'bbc5e661e106c6dcd8dc6dd186454c2fcba3c710fb4d8e71a60c93eaf077f073');
});

test('Unsplash reports every actual request with the actual query, result count, metadata and tracking outcome; observer failures are isolated',async()=>{
 const events=[],calls=[];let n=0;
 const photo={urls:{regular:'https://images.unsplash.com/photo-test'},user:{name:'Name',username:'name'},links:{download_location:'https://api.unsplash.com/photos/test/download'}};
 const api=await moduleLoader('utils/ai/unsplash.ts',{fetch:async(url)=>{calls.push(String(url));return new Response(JSON.stringify({results:++n===1?[]:[photo]}),{status:200,headers:{'X-Ratelimit-Limit':'50','X-Ratelimit-Remaining':String(50-n)}});}});
 const image=await api.searchJourneyImages('ordinary neon diner window reflections',AbortSignal.timeout(5000),async e=>events.push(e));
 assert.ok(image);assert.equal(events.length,2);assert.equal(events[0].query,'ordinary neon diner window reflections');assert.equal(events[1].query,'diner window reflections New York');
 assert.deepEqual(events.map(e=>e.search),['initial','broader']);assert.deepEqual(events.map(e=>e.result_count),[0,1]);assert.deepEqual(events.map(e=>e.rate_remaining),[49,48]);
 assert.ok(events.every(e=>e.duration_ms>=0&&e.created_at&&!JSON.stringify(e).includes('Client-ID')));
 await api.trackPublishedPhoto(photo.links.download_location,async e=>events.push(e));
 assert.equal(events[2].search,'publish_tracking');assert.equal(events[2].outcome,'found');assert.equal(events[2].result_count,null);assert.equal(events[2].query.includes('https:'),false);
 assert.equal(calls.length,3);
 await assert.doesNotReject(api.searchJourneyImages('New York street',AbortSignal.timeout(5000),async()=>{throw Error('logger');}));
 const broken=await moduleLoader('utils/ai/unsplash.ts',{fetch:async()=>new Response('',{status:429,headers:{'X-Ratelimit-Remaining':'0'}})});
 await assert.rejects(broken.trackPublishedPhoto(photo.links.download_location,async e=>events.push(e)));
 assert.equal(events.at(-1).outcome,'error');assert.equal(events.at(-1).http_status,429);assert.equal(events.at(-1).rate_remaining,0);
});

test('generation commits before draining slow observations and records all calls without leaking text to console',{timeout:5000},async()=>{
 const rows=[],telemetry=[];let runUpdates=0;let releaseLogs; const logsReady=new Promise(resolve=>{releaseLogs=resolve;});
 const run='11111111-1111-4111-8111-111111111111',journey='22222222-2222-4222-8222-222222222222';
 const client={from(table){const q={insert(row){rows.push({table,...row});return q;},update(){if(table==='generation_runs')runUpdates++;return q;},eq(){return q;},is(){return q;},abortSignal(){return q;},then(resolve){if(table==='llm_responses'||table==='image_searches')logsReady.then(()=>resolve({error:null}));else resolve({error:null});}};return q;},rpc(name){if(name==='save_generated_journey')releaseLogs();const p=Promise.resolve({data:name==='reserve_journey_generation'?run:journey,error:null});p.abortSignal=()=>p;return p;}};
 const generated={cover_image_query:'cover query New York',stops:[{image_query:'stop one New York'},{image_query:'stop two New York'},{image_query:'stop two New York'}]};
 const validation=await moduleLoader('utils/journeys/validation.ts');
 const api=await moduleLoader('utils/supabase/journeys.ts',{
  console:{info:(...args)=>telemetry.push(args),warn(){}},
  './server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})}})},
  '@supabase/supabase-js':{createClient:()=>client},
  '../ai/gemini':{configuredModel:()=> 'primary',generateJourneyText:async(_system,prompt,_model,_signal,callbacks)=>{await callbacks.onTiming({model:'primary',provider_attempt:1,outcome:'error',response_output:null,status:503,error_message:'Provider request failed.',is_fallback:false,duration_ms:10,created_at:new Date().toISOString()});await callbacks.onTiming({model:'fallback',provider_attempt:2,outcome:'success',response_output:'private output',error_message:null,is_fallback:true,duration_ms:20,created_at:new Date().toISOString()});assert.ok(prompt);return 'private output';}},
  '../journeys/validation':{...validation,validateInput:x=>x,validateOutput:()=>generated,JourneyOutputError:class extends Error{},JourneyServiceError:class extends Error{}},
  '../ai/unsplash':{searchJourneyImages:async(query,_signal,report)=>{await report({query,search:'initial',outcome:'found',result_count:3,http_status:200,rate_limit:50,rate_remaining:47,duration_ms:5,created_at:new Date().toISOString()});return null;},trackPublishedPhoto(){}},
 });
 assert.equal((await api.generateJourney({time:'afternoon'})).journey_id,journey);
 const llm=rows.filter(r=>r.table==='llm_responses'),images=rows.filter(r=>r.table==='image_searches');
 assert.equal(llm.length,2);assert.equal(llm[0].generation_run_id,run);assert.equal(llm[0].validation_attempt,1);assert.equal(llm[1].is_fallback,true);assert.equal(llm[1].response_output,'private output');assert.equal(llm[1].system_prompt_hash.length,64);
 assert.deepEqual(images.map(r=>r.position),[0,1,2]);assert.equal(images.length,3,'duplicate image queries share one actual provider search');assert.equal(runUpdates,1);
 assert.equal(JSON.stringify(telemetry).includes('private output'),false);assert.equal(JSON.stringify(telemetry).includes('cover query'),false);
});

test('publication tracking rows link both run and journey; a logging outage never changes committed publication',async()=>{
 const id='33333333-3333-4333-8333-333333333333',run='44444444-4444-4444-8444-444444444444';
 for(const loggingOutage of [false,true]) {
  const writes=[];
  const client={from(table){const q={select(){return q;},eq(){return q;},order(){return q;},maybeSingle:async()=>({data:{id,generation_run_id:run},error:null}),then(resolve){resolve({data:[1,2,3].map(position=>({position})),error:null});},insert(row){if(loggingOutage)throw Error('database unavailable');writes.push({table,...row});return{abortSignal:async()=>({error:null})};}};return q;},rpc:async()=>({data:[{position:0,image:{download_location:'https://api.unsplash.com/photos/test/download'}}],error:null})};
  const api=await moduleLoader('utils/supabase/journeys.ts',{
   './server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})}})},
   '@supabase/supabase-js':{createClient:()=>client},
   '../ai/gemini':{configuredModel(){},generateJourneyText(){}},
   '../ai/unsplash':{searchJourneyImages(){},trackPublishedPhoto:async(_url,report)=>report({query:'Published photo download tracking',search:'publish_tracking',outcome:'found',result_count:null,http_status:200,rate_limit:50,rate_remaining:42,duration_ms:30,created_at:new Date().toISOString()})},
  });
  assert.equal((await api.publishJourney(id,[0,1,2,3].map(position=>({position,candidate_index:0})))).journey_id,id);
  if(!loggingOutage){assert.equal(writes.length,1);assert.equal(writes[0].generation_run_id,run);assert.equal(writes[0].journey_id,id);assert.equal(writes[0].position,0);assert.equal(writes[0].search_kind,'publish_tracking');}
 }
});
