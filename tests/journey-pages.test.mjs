import assert from 'node:assert/strict';
import test from 'node:test';
import * as jsx from 'react/jsx-runtime';
import { moduleLoader } from './helpers/module-loader.mjs';

const id='33333333-3333-4333-8333-333333333333';
function dependencies({signedIn=false,own=false,published=false}={}){
  const events=[];
  const redirect=location=>{throw {redirect:location};};
  const notFound=()=>{throw {notFound:true};};
  return {events,deps:{
    'react/jsx-runtime':jsx,react:{cache:f=>f},'next/navigation':{redirect,notFound},
    '@/utils/supabase/server':{getOptionalUser:async()=>signedIn?{id:'authenticated-owner'}:null},
    '@/utils/supabase/journeys':{
      getGenerationQuota:async()=>{events.push('quota');return {remaining:10};},
      getOwnDraft:async requested=>{events.push('draft');return own?{id:requested,status:'draft',title:'Private title'}:null;},
      getPublishedJourney:async requested=>published?{id:requested,status:'published',title:'Published title',hook:'A short hook'}:null,
      getJourneyVoteCounts:async()=>({up:2,down:1}),
      getOwnJourneyVote:async()=>{events.push('own-vote');return null;},
    },
    './create-form':{CreateForm:()=>null},'./preview-editor':{PreviewEditor:()=>null},
    '@/app/components/journey-article':{JourneyArticle:()=>null},'@/app/components/vote-controls':{VoteControls:()=>null},
  }};
}

test('anonymous Create and Preview pages redirect before reading quota or private content',async()=>{
  const d=dependencies();
  const create=await moduleLoader('app/create/page.tsx',d.deps);
  await assert.rejects(create.default(),e=>e.redirect==='/signin?next=%2Fcreate');
  const preview=await moduleLoader('app/preview/[id]/page.tsx',d.deps);
  await assert.rejects(preview.default({params:Promise.resolve({id})}),e=>e.redirect===`/signin?next=${encodeURIComponent(`/preview/${id}`)}`);
  assert.deepEqual(d.events,[]);
});
test('another user’s draft is not rendered, while the owner can preview it',async()=>{
  const other=dependencies({signedIn:true});
  const hidden=await moduleLoader('app/preview/[id]/page.tsx',other.deps);
  await assert.rejects(hidden.default({params:Promise.resolve({id})}),e=>e.notFound);
  const own=dependencies({signedIn:true,own:true});
  const visible=await moduleLoader('app/preview/[id]/page.tsx',own.deps);
  const page=await visible.default({params:Promise.resolve({id})});
  assert.equal(page.props.children.props.journey.id,id);
  assert.equal(visible.metadata.robots.index,false);
});
test('public Journey pages and metadata never expose drafts, even to their author',async()=>{
  const d=dependencies({signedIn:true,own:true});
  const page=await moduleLoader('app/journeys/[id]/page.tsx',d.deps);
  await assert.rejects(page.default({params:Promise.resolve({id})}),e=>e.notFound);
  const metadata=await page.generateMetadata({params:Promise.resolve({id})});
  assert.equal(metadata.title,'Journey not found');
  assert.deepEqual(d.events,[]);
});
test('published Journey pages render for anonymous readers without a private vote read',async()=>{
  const d=dependencies({published:true});
  const page=await moduleLoader('app/journeys/[id]/page.tsx',d.deps);
  const rendered=await page.default({params:Promise.resolve({id})});
  assert.equal(rendered.props.children.props.voting.authenticated,false);
  assert.deepEqual(d.events,[]);
});
