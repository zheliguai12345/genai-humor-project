import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/module-loader.mjs';
const input={time:'afternoon',budget:'under $25',vibes:[],wild_idea:'A quiet alien day'};
test('streamed provider recovery and photo progress come from real server events, including split Unicode chunks',async()=>{
  const events=[],calls=[];
  const encoded=new TextEncoder().encode([
    {type:'progress',stage:'model',attempt:1},{type:'progress',stage:'provider_retry',attempt:1},{type:'progress',stage:'fallback',attempt:1},
    {type:'progress',stage:'photos',attempt:1},{type:'progress',stage:'saving',attempt:1},{type:'complete',data:{journey_id:'owned-draft'}},
  ].map(e=>JSON.stringify(e)).join('\n')+'\n');
  const {requestGeneration}=await moduleLoader('utils/journeys/generation-stream.ts',{fetch:async(url,options)=>{
    calls.push({url,options});return new Response(new ReadableStream({start(controller){for(let i=0;i<encoded.length;i+=7)controller.enqueue(encoded.slice(i,i+7));controller.close();}}));
  }});
  const result=await requestGeneration(input,p=>events.push(p.stage),AbortSignal.timeout(1000));
  assert.deepEqual(events,['model','provider_retry','fallback','photos','saving']);assert.equal(result.data.journey_id,'owned-draft');
  assert.equal(calls.length,1);assert.equal(calls[0].options.headers.Accept,'application/x-ndjson');assert.equal(calls[0].options.body,JSON.stringify(input));
});
test('stream errors preserve quota and never silently retry; interrupted success is not invented',async()=>{
  const failure=await moduleLoader('utils/journeys/generation-stream.ts',{fetch:async()=>new Response(JSON.stringify({type:'error',error:'Google is busy',quota:{remaining:3}})+'\n')});
  const result=await failure.requestGeneration(input,()=>{},AbortSignal.timeout(1000));assert.equal(result.error,'Google is busy');assert.equal(result.quota.remaining,3);
  const ended=await moduleLoader('utils/journeys/generation-stream.ts',{fetch:async()=>new Response(JSON.stringify({type:'progress',stage:'photos',attempt:1})+'\n')});
  await assert.rejects(ended.requestGeneration(input,()=>{},AbortSignal.timeout(1000)),/interrupted/);
});
