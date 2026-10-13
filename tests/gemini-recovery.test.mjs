import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/module-loader.mjs';
const primary='gemini-3.8-flash';
async function adapter(responses) {
  const calls=[],delays=[],progress=[],models=[],timings=[],timeouts=[];
  const api=await moduleLoader('utils/ai/gemini.ts',{
    AbortSignal:{any:signals=>AbortSignal.any(signals),timeout:ms=>{timeouts.push(ms);return AbortSignal.timeout(ms);}},
    '@google/genai':{ThinkingLevel:{LOW:'LOW',MINIMAL:'MINIMAL'},GoogleGenAI:class{
      constructor(options){assert.equal(options.httpOptions.retryOptions.attempts,1);}
      models={generateContent:async request=>{calls.push(request);const next=responses.shift();if(next instanceof Error)throw next;return {text:next??'complete'};}};
    }},setTimeout:(callback,ms)=>{delays.push(ms);queueMicrotask(callback);return 1;},clearTimeout:()=>{},
  });
  const run=()=>api.generateJourneyText('system','user',primary,AbortSignal.timeout(90_000),{
    onProgress:s=>progress.push(s),onModelUsed:m=>models.push(m),onTiming:t=>timings.push(t),
  });
  return {api,run,calls,delays,progress,models,timings,timeouts};
}
const failure=status=>Object.assign(Error('Never expose this provider detail'),{status});
test('503 then success retries the primary once after two seconds, without falling back',async()=>{
  const a=await adapter([failure(503),'raw']);assert.equal(await a.run(),'raw');
  assert.deepEqual(a.calls.map(c=>c.model),[primary,primary]);assert.deepEqual(a.delays,[2000]);assert.deepEqual(a.progress,['provider_retry']);
  assert.equal(a.timings[0].status,503);assert.equal(a.timings[1].outcome,'success');
});
test('503/504 exhaustion calls default fallback exactly once with its supported minimal thinking',async()=>{
  const a=await adapter([failure(503),failure(504),'fallback raw']);assert.equal(await a.run(),'fallback raw');
  assert.deepEqual(a.models,[primary,primary,'gemini-3.5-flash-lite']);assert.deepEqual(a.progress,['provider_retry','fallback']);
  assert.equal(a.calls[0].config.thinkingConfig.thinkingLevel,'LOW');assert.equal(a.calls[2].config.thinkingConfig.thinkingLevel,'MINIMAL');
  assert.equal(a.calls.length,3);assert.deepEqual(a.delays,[2000]);
  assert.deepEqual(a.timeouts,[60000,60000,12000]);
});
test('400, 403, 429 and unrelated network failures never retry; fallback failure never recurses',async()=>{
  for(const error of [failure(400),failure(403),failure(429),Object.assign(Error('network'),{code:'ENOTFOUND'})]){
    const a=await adapter([error]);await assert.rejects(a.run());assert.equal(a.calls.length,1);assert.equal(a.delays.length,0);
    assert.equal(a.api.retryableProviderFailure(error,true),!!(error.code==='ENOTFOUND'));
  }
  const a=await adapter([failure(503),failure(504),failure(503)]);await assert.rejects(a.run());assert.equal(a.calls.length,3);
});
test('network timeout recovery and abort are bounded by the overall deadline',async()=>{
  const a=await adapter([Object.assign(Error('timeout'),{code:'ETIMEDOUT'}),'raw']);assert.equal(await a.run(),'raw');assert.equal(a.calls.length,2);
  const controller=new AbortController();controller.abort();
  await assert.rejects(a.api.generateJourneyText('system','user',primary,controller.signal));assert.equal(a.calls.length,2);
});
