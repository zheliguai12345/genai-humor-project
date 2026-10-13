import assert from 'node:assert/strict';
import test from 'node:test';
import { imageTargets, quotaProvider, repairImages, deleteReviewedJourney } from '../scripts/repair-published-images.mjs';
import { moduleLoader } from './helpers/module-loader.mjs';

const rawPhoto={urls:{regular:'https://images.unsplash.com/photo-isolated?ixid=keep'},user:{name:'Photographer',username:'photographer'},links:{download_location:'https://api.unsplash.com/photos/isolated/download'}};
const row={journey_id:'isolated',journey_title:'A walk',position:1,search_query:'Faicco New York'};
function providerFixture({remaining=20,empty=false,status=200}={}) {
  const calls=[],logs=[];
  const provider=quotaProvider('private-isolated-key',async (url,options)=>{
    calls.push({url:String(url),options});
    return new Response(JSON.stringify({results:empty?[]:[rawPhoto]}),{status,headers:{'X-Ratelimit-Remaining':String(remaining-calls.length),'X-Ratelimit-Limit':'50'}});
  },(...args)=>logs.push(args));
  return {provider,calls,logs};
}
test('maintenance selects only published null images, using the first stop for an empty cover',()=>{
  const rows=imageTargets([{id:'isolated',title:'A walk',status:'published',cover_image:null,journey_stops:[
    {position:2,place:'Columbus Park, watching chess',image:rawPhoto},
    {position:1,place:"Faicco's Italian Specialties, 260 Bleecker St, order here",image:null},
  ]},{id:'private',status:'draft',cover_image:null,journey_stops:[]}]);
  assert.deepEqual(rows.map(r=>r.position),[0,1]);
  assert.ok(rows.every(r=>r.search_query==="Faicco's Italian Specialties, 260 Bleecker St New York"));
});
test('repair takes one first result, preserves its hotlink, saves once and tracks once',async()=>{
  const f=providerFixture(),saved=[];
  const result=await repairImages([row],{provider:f.provider,save:async(r,image)=>{saved.push({r,image});return true;},exists:async()=>true,log(){}});
  assert.equal(result.updated,1);assert.equal(f.calls.length,3);
  assert.equal(new URL(f.calls[1].url).searchParams.get('per_page'),'1');
  assert.equal(new URL(f.calls[1].url).searchParams.get('query'),row.search_query);
  assert.equal(saved[0].image.url,rawPhoto.urls.regular);assert.equal(saved[0].image.candidates.length,1);
  assert.equal(f.calls[2].url,rawPhoto.links.download_location);
  assert.doesNotMatch(JSON.stringify(f.logs),/private-isolated-key|Authorization|Client-ID/);
});
test('insufficient quota stops the batch after one probe, before any search or database write',async()=>{
  const f=providerFixture({remaining:7});let writes=0;
  await assert.rejects(repairImages([row],{provider:f.provider,save:async()=>{writes++;return true;},exists:async()=>true}),/Insufficient/);
  assert.equal(f.calls.length,1);assert.equal(writes,0);
});
test('empty results, vanished Journeys and concurrent photo updates never trigger tracking',async()=>{
  for(const mode of ['empty','missing','already-filled']) {
    const f=providerFixture({empty:mode==='empty'});let writes=0;
    const result=await repairImages([row],{provider:f.provider,save:async()=>{writes++;return false;},exists:async()=>mode!=='missing',log(){}});
    assert.equal(result.updated,0);assert.equal(result.skipped,1);
    assert.ok(f.calls.every(call=>!call.url.includes('/download')));
    assert.equal(writes,mode==='already-filled'?1:0);
  }
});
test('rate limiting is observable in a probe but prevents writes and automatic retries',async()=>{
  const f=providerFixture({remaining:1,status:429});let writes=0;
  await assert.rejects(repairImages([row],{provider:f.provider,save:async()=>{writes++;return true;},exists:async()=>true}),/Insufficient/);
  assert.equal(f.calls.length,1);assert.equal(writes,0);assert.match(JSON.stringify(f.logs),/429/);
});
test('application search and download logs include only status/quota metadata, even for a 429',async()=>{
  const logs=[],timings=[];
  const api=await moduleLoader('utils/ai/unsplash.ts',{console:{info:(...args)=>logs.push(args)},fetch:async()=>new Response('{}',{status:429,headers:{'X-Ratelimit-Remaining':'0','X-Ratelimit-Limit':'50'}})});
  assert.equal(await api.searchJourneyImages('New York',AbortSignal.timeout(1000),event=>timings.push(event)),null);
  await assert.rejects(api.trackPublishedPhoto(rawPhoto.links.download_location),/tracking/);
  assert.equal(timings[0].http_status,429);assert.equal(timings[0].rate_remaining,0);
  assert.equal(logs.length,2);assert.doesNotMatch(JSON.stringify(logs),/isolated-test|Authorization|Client-ID|https/);
});

const deletion={id:'17395993-cae7-47a8-b682-cdfe72d63a47',title:'Low Life, High Voltage',journeys:1,stops:4,votes:1,generation_runs_detached:1};
function deletionDatabase(votes=1) {
  const writes=[];
  return {writes,from(table) {
    const filters=[];let removed=false;
    return {select(){return this;},eq(key,value){filters.push([key,value]);return this;},
      maybeSingle:async()=>({data:{id:deletion.id,title:deletion.title,status:'published',is_editorial:false},error:null}),
      delete(){removed=true;writes.push({table,filters});return this;},
      then(resolve,reject){return Promise.resolve({data:removed?[{id:deletion.id}]:null,error:null,count:{journey_stops:4,journey_votes:votes,generation_runs:1}[table]}).then(resolve,reject);}};
  }};
}
test('reviewed deletion deletes only the exact parent; existing foreign keys handle related rows',async()=>{
  const db=deletionDatabase();await deleteReviewedJourney(db,deletion);
  assert.equal(db.writes.length,1);assert.equal(db.writes[0].table,'journeys');
  assert.deepEqual(db.writes[0].filters,[['id',deletion.id],['title',deletion.title],['status','published'],['is_editorial',false]]);
});
test('changed deletion counts or a different Journey stop before any deletion',async()=>{
  const db=deletionDatabase(2);
  await assert.rejects(deleteReviewedJourney(db,deletion),/counts changed/);
  await assert.rejects(deleteReviewedJourney(db,{...deletion,id:'someone-else'}),/limited/);
  assert.equal(db.writes.length,0);
});
