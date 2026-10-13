// Local quality verification only. This script never imports Supabase or writes its data.
import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import nextEnv from '@next/env';
import { moduleLoader } from '../tests/helpers/module-loader.mjs';
if(!process.argv.includes('--run-live'))throw Error('Live model calls require the explicit --run-live flag.');
nextEnv.loadEnvConfig(process.cwd());
const gemini=await moduleLoader('utils/ai/gemini.ts',{'@google/genai':{GoogleGenAI}},process.env);
const prompts=await moduleLoader('utils/ai/journey-prompt.ts');
const validation=await moduleLoader('utils/journeys/validation.ts');
const cases=[
  {time:'afternoon',budget:'under $25',vibes:['absurd'],wild_idea:"An Alien's First Day on Earth — Explain humanity through New York."},
  {time:'evening',budget:'under $50',vibes:['food','night'],wild_idea:''},
];
const folder=path.resolve('docs/phase-3/quality');await fs.mkdir(folder,{recursive:true});
const retry=process.argv.includes('--retry-case=1');
if(retry){
  const previous=JSON.parse(await fs.readFile(path.join(folder,'run-1.json'),'utf8'));
  if(previous.status!=='failed'||(await fs.readdir(folder)).includes('run-1-retry.json'))throw Error('Only one explicit retry of the failed first case is allowed.');
}else if((await fs.readdir(folder)).some(name=>/^run-\d\.json$/.test(name)))throw Error('Quality records already exist. Do not automatically repeat paid calls.');
for(const i of retry?[0]:[0,1]){
  const input=validation.validateInput(cases[i]);
  const record={input,system_prompt:prompts.SYSTEM_PROMPT,user_prompt:prompts.generationPrompt(input),model:gemini.configuredModel(),raw_output:null,status:'failed',error:'Interrupted before completion',created_at:new Date().toISOString()};
  const file=path.join(folder,`run-${i+1}${retry?'-retry':''}.json`);
  await fs.writeFile(file,JSON.stringify(record,null,2)+'\n');
  try{
    // Exactly one SDK attempt per case. No automatic validation or transport retry.
    record.raw_output=await gemini.generateJourneyText(record.system_prompt,record.user_prompt,record.model,AbortSignal.timeout(60_000));
    await fs.writeFile(path.join(folder,`journey-${i+1}-raw.json`),record.raw_output);
    record.normalized_output=validation.validateOutput(record.raw_output);
    record.status='success';record.error=null;
  }catch(error){record.error='Generation or validation did not complete. Raw output, when available, is retained.';if(typeof error?.status==='number')record.provider_status=error.status;}
  await fs.writeFile(file,JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({case:i+1,status:record.status,stops:record.normalized_output?.stops.length,raw_characters:record.raw_output?.length}));
}
