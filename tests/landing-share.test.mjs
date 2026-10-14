import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleLoader,root} from './helpers/module-loader.mjs';

const journey={id:'published-id',status:'published',title:'A new premise',hook:'The city becomes a stage.'};
function nodes(element,result=[]) {
  if(!element||typeof element!=='object')return result;
  if(Array.isArray(element)){element.forEach(item=>nodes(item,result));return result;}
  result.push(element);nodes(element.props?.children,result);return result;
}
async function shareWidget(navigator,{desktop=false,iconOnly=true}={}) {
  const slots=[],timers=[];let cursor=0,stopped=0,prevented=0;
  const hooks={useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],next=>slots[index]=next];},
    useRef(initial){const index=cursor++;return slots[index]??={current:initial};},useEffect(){}};
  const api=await moduleLoader('app/components/share-button.tsx',{'react/jsx-runtime':jsx,react:hooks,navigator,
    window:{location:{origin:'https://preview.example.test'},matchMedia(query){assert.equal(query,'(hover: hover) and (pointer: fine)');return {matches:desktop};}},
    setTimeout:(callback,delay)=>{timers.push({callback,delay});return timers.length;},clearTimeout(){}});
  const render=(status='published')=>{cursor=0;return nodes(api.ShareButton({journey:{...journey,status},iconOnly}));};
  return {render,timers,stopped:()=>stopped,prevented:()=>prevented,
    click:()=>render().find(n=>n.type==='button').props.onClick({preventDefault(){prevented++;},stopPropagation(){stopped++;}})};
}
test('touch native sharing sends title, hook and absolute public URL without bubbling to the card',async()=>{
  const calls=[];const w=await shareWidget({share:async data=>calls.push(data)});await w.click();
  assert.equal(calls.length,1);assert.equal(calls[0].title,journey.title);assert.equal(calls[0].text,journey.hook);
  assert.equal(calls[0].url,'https://preview.example.test/journeys/published-id');assert.equal(w.stopped(),1);assert.equal(w.prevented(),1);
  assert.equal(w.render('draft').length,0);
});
test('clipboard fallback shows Link copied for two seconds; cancellation is silent and failures are friendly',async()=>{
  const copied=[];const w=await shareWidget({clipboard:{writeText:async url=>copied.push(url)}});await w.click();
  assert.deepEqual(copied,['https://preview.example.test/journeys/published-id']);
  assert.ok(w.render().some(n=>n.props?.role==='status'&&n.props.children==='Link copied'));
  assert.equal(w.timers[0].delay,2000);w.timers[0].callback();assert.ok(!w.render().some(n=>n.props?.role==='status'));
  const cancelled=await shareWidget({share:async()=>{throw {name:'AbortError'};}});await cancelled.click();
  assert.ok(!cancelled.render().some(n=>n.props?.role==='alert'));
  const failed=await shareWidget({clipboard:{writeText:async()=>{throw Error('Permission denied');}}});await failed.click();
  assert.ok(failed.render().some(n=>n.props?.role==='alert'));
});
test('hero films are duplicated, decorative and noninteractive; motion and narrow layouts have CSS fallbacks',async()=>{
  const {LandingHero}=await moduleLoader('app/components/landing-hero.tsx',{'react/jsx-runtime':jsx,
    'next/link':{default:({children,...props})=>React.createElement('a',props,children)}});
  const covers=[{...journey,cover_image:{url:'https://images.unsplash.com/film'}},
    {...journey,id:'draft',status:'draft',title:'Private film',cover_image:{url:'https://images.unsplash.com/private'}},
    {...journey,id:'empty',cover_image:null}];
  const html=renderToStaticMarkup(React.createElement(LandingHero,{covers}));
  assert.equal((html.match(/class="filmstrip-frame"/g)||[]).length,4);
  assert.equal((html.match(/aria-hidden="true"/g)||[]).length,3);
  assert.doesNotMatch(html,/Private film|images\.unsplash\.com\/private|tabindex/);
  assert.match(html,/Pick a premise/);assert.match(html,/See the route/);assert.match(html,/href="#discover"/);
  assert.match(html,/media="\(min-width: 901px\)"/);assert.match(html,/loading="eager"/);
  assert.match(html,/src="data:image\/gif;base64,/);
  const css=fs.readFileSync(root+'/app/globals.css','utf8');
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?animation:none/);
  assert.match(css,/@media\(max-width:900px\)[\s\S]*?\.hero-filmstrip \{ display:none/);
  assert.match(css,/\.hero-filmstrip \{[^}]*pointer-events:none/);
});

for (const iconOnly of [true,false]) {
  test(`desktop ${iconOnly ? 'card' : 'detail'} sharing copies even when native sharing is available`,async()=>{
    const copied=[];let nativeCalls=0;
    const w=await shareWidget({share:async()=>{nativeCalls++;},clipboard:{writeText:async url=>copied.push(url)}},{desktop:true,iconOnly});
    await w.click();
    assert.equal(nativeCalls,0);assert.deepEqual(copied,['https://preview.example.test/journeys/published-id']);
    assert.ok(w.render().some(n=>n.props?.role==='status'&&n.props.children==='Link copied'));
    assert.equal(w.timers[0].delay,2000);w.timers[0].callback();
    assert.ok(!w.render().some(n=>n.props?.role==='status'));
    assert.equal(w.stopped(),1);
  });
}
test('photo information button is a compact dark circle enabled only for devices without hover',()=>{
  const css=fs.readFileSync(root+'/app/globals.css','utf8');
  const base=css.match(/\.photo-info \{([^}]+)\}/)[1];
  assert.match(base,/display:none/);assert.match(base,/width:24px; height:24px/);
  assert.match(base,/background:rgba\(0,0,0,\.45\); color:#fff/);
  assert.match(css,/@media\(hover:none\) \{ \.photo-info \{ display:grid; \} \}/);
  assert.doesNotMatch(css,/\.photo-overlay:hover \.photo-info/);
  assert.equal((css.match(/\.photo-info \{/g)||[]).length,2);
});
