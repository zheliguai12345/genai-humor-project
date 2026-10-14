import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { moduleLoader } from './helpers/module-loader.mjs';
const id='55555555-5555-4555-8555-555555555555';
function nodes(element,result=[]){if(!element||typeof element!=='object')return result;if(Array.isArray(element)){element.forEach(e=>nodes(e,result));return result;}result.push(element);nodes(element.props?.children,result);return result;}
async function widget(authenticated=true){
  const slots=[],requests=[],tasks=[];let cursor=0;
  const hooks={useId:()=>"popup-test",useEffect(){},useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],next=>slots[index]=typeof next==='function'?next(slots[index]):next];},
    useRef(initial){const index=cursor++;return slots[index]??=( {current:initial} );},useTransition(){cursor++;return [false,task=>tasks.push(task())];}};
  const {VoteControls}=await moduleLoader('app/components/vote-controls.tsx',{'react/jsx-runtime':jsx,react:hooks,
    'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'next/navigation':{usePathname:()=>"/",useRouter:()=>({refresh(){}})},'@/app/journey-actions':{vote:(journey,value)=>new Promise(resolve=>requests.push({journey,value,resolve}))}});
  function render(){cursor=0;return nodes(VoteControls({journeyId:id,authenticated,currentVote:null,counts:{up:2,down:1}}));}
  return {requests,tasks,render,score:()=>render().find(n=>n.props?.className==='vote-score').props.children,
    click:direction=>render().find(n=>n.type==='button'&&n.props['aria-label']===(direction==='up'?(n.props['aria-pressed']?'Cancel upvote':'Upvote'):(n.props['aria-pressed']?'Cancel downvote':'Downvote')))?.props.onClick({currentTarget:{focus(){}}})};
}
test('card upvote → cancel → vote updates score immediately and sends null for cancellation',async()=>{
  const w=await widget();w.click('up');assert.equal(w.score(),2);assert.equal(w.requests[0].value,'up');
  w.requests[0].resolve({data:{value:'up'}});await w.tasks[0];w.click('up');assert.equal(w.score(),1);assert.equal(w.requests[1].value,null);
  w.requests[1].resolve({data:{value:null}});await w.tasks[1];w.click('down');assert.equal(w.score(),0);assert.equal(w.requests[2].value,'down');
  w.requests[2].resolve({data:{value:'down'}});await w.tasks[2];w.click('up');assert.equal(w.score(),2);assert.equal(w.requests[3].value,'up');
  w.requests[3].resolve({data:{value:'up'}});await w.tasks[3];
});
test('failed votes and failed cancellations roll back selection and score, with an alert',async()=>{
  const w=await widget();w.click('up');w.click('down');assert.equal(w.requests.length,1,'pending requests cannot race');
  w.requests[0].resolve({error:'Vote not saved'});await w.tasks[0];assert.equal(w.score(),1);assert.ok(w.render().some(n=>n.props?.role==='alert'));
  w.click('up');w.requests[1].resolve({data:{value:'up'}});await w.tasks[1];w.click('up');assert.equal(w.score(),1);
  w.requests[2].resolve({error:'Cancel failed'});await w.tasks[2];assert.equal(w.score(),2);assert.ok(w.render().some(n=>n.props?.['aria-label']==='Cancel upvote'));
});
test('anonymous card votes open local sign-in guidance without invoking any mutation',async()=>{
  const w=await widget(false);w.click('up');assert.equal(w.requests.length,0);assert.equal(w.score(),1);
  assert.ok(w.render().some(n=>n.props?.role==='dialog'));assert.ok(w.render().some(n=>n.props?.children==='Sign in with Google'&&n.props.href==='/signin?next=%2F'));
});
test('card markup includes the shared vote widget and metadata, while private cards have only status',async()=>{
  const {JourneyCard}=await moduleLoader('app/components/journey-card.tsx',{'react/jsx-runtime':jsx,react:React,
    'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
    'next/navigation':{usePathname:()=>"/",useRouter:()=>({refresh(){}})},'@/app/journey-actions':{vote:()=>{throw Error('No writes during rendering');}}});
  const journey={id,status:'published',title:'Small adventure',hook:'A short premise.',area:'Queens',budget_label:'Under $25',mode:'Walking · 4 stops',cover_image:null};
  const publicHtml=renderToStaticMarkup(React.createElement(JourneyCard,{journey,counts:{up:3,down:1},authenticated:true,currentVote:'up',truncateHook:true}));
  assert.match(publicHtml,/Cancel upvote/);assert.match(publicHtml,/Downvote/);assert.match(publicHtml.replace(/<[^>]*>/g,''),/Queens · Under \$25 · 4 stops/);assert.match(publicHtml,/class="card-link"/);
  const privateHtml=renderToStaticMarkup(React.createElement(JourneyCard,{journey:{...journey,status:'draft'},privateView:true}));
  assert.match(publicHtml,/card-hook-truncated/);
  assert.match(publicHtml,/aria-label="Share this journey"/);
  assert.doesNotMatch(privateHtml,/Share this journey/);
  assert.match(privateHtml,/Draft/);assert.match(privateHtml,/\/preview\//);assert.doesNotMatch(privateHtml,/Upvote|Downvote|card-hook-truncated/);
});
