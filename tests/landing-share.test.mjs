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
async function shareEnvironment(navigator,{desktop=false}={}) {
  const timers=[],listeners=new Map();let instance;
  const hooks={
    useState(initial){const host=instance,index=host.cursor++;if(!(index in host.slots))host.slots[index]=initial;return [host.slots[index],next=>host.slots[index]=next];},
    useRef(initial){const index=instance.cursor++;return instance.slots[index]??={current:initial};},
    useEffect(callback){const index=instance.cursor++;if(!(index in instance.slots)){instance.slots[index]=true;instance.effects.push(callback);}}
  };
  const document={
    addEventListener(type,fn,capture=false){const list=listeners.get(type)??[];list.push({fn,capture});listeners.set(type,list);},
    removeEventListener(type,fn,capture=false){listeners.set(type,(listeners.get(type)??[]).filter(item=>item.fn!==fn||item.capture!==capture));}
  };
  const api=await moduleLoader('app/components/share-button.tsx',{'react/jsx-runtime':jsx,react:hooks,navigator,
    window:{document,location:{origin:'https://preview.example.test'},matchMedia(query){assert.equal(query,'(hover: hover) and (pointer: fine)');return {matches:desktop};}},
    setTimeout:(callback,delay)=>{timers.push({callback,delay,cleared:false});return timers.length;},clearTimeout(id){timers[id-1].cleared=true;}});
  const environment={timers,listeners,emit(type,event={}){for(const {fn} of listeners.get(type)??[])fn(event);},
    widget({iconOnly=true}={}){
      const host={slots:[],effects:[],cleanups:[],cursor:0};let stopped=0,prevented=0;
      const target={contains(node){return node===target||node?.parent===target;}};
      const render=(status='published')=>{
        instance=host;host.cursor=0;
        const tree=nodes(api.ShareButton({journey:{...journey,status},iconOnly}));
        const ref=tree.find(n=>n.type==='button')?.props.ref;if(ref)ref.current=target;
        for(const effect of host.effects.splice(0))host.cleanups.push(effect());
        return tree;
      };
      return {render,timers,target,environment,stopped:()=>stopped,prevented:()=>prevented,
        unmount(){for(const cleanup of host.cleanups)cleanup();},
        click:()=>render().find(n=>n.type==='button').props.onClick({preventDefault(){prevented++;},stopPropagation(){stopped++;}})};
    }
  };
  return environment;
}
async function shareWidget(navigator,options={}) {
  return (await shareEnvironment(navigator,options)).widget(options);
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

test('only the latest sharing button owns a toast, including overlapping clipboard promises',async()=>{
  let finish;
  const env=await shareEnvironment({clipboard:{writeText:()=>new Promise(resolve=>{finish=resolve;})}},{desktop:true});
  const first=env.widget(),second=env.widget({iconOnly:false});
  const pendingFirst=first.click(),resolveFirst=finish;
  const pendingSecond=second.click();finish();await pendingSecond;
  resolveFirst();await pendingFirst;
  const visible=w=>w.render().some(n=>n.props?.role==='status');
  assert.equal(visible(first),false);assert.equal(visible(second),true);
  const pendingNext=first.click();assert.equal(visible(second),false);
  assert.equal(env.timers[0].cleared,true);finish();await pendingNext;
  assert.equal(visible(first),true);assert.equal(visible(second),false);
  first.unmount();second.unmount();
});
test('outside pointerdown, Escape and captured scroll dismiss; own-button pointers and other keys do not',async()=>{
  const w=await shareWidget({clipboard:{writeText:async()=>{}}},{desktop:true});
  const visible=()=>w.render().some(n=>n.props?.role==='status');
  await w.click();w.environment.emit('pointerdown',{target:{parent:w.target}});assert.equal(visible(),true);
  w.environment.emit('keydown',{key:'Enter'});assert.equal(visible(),true);
  for(const [type,event] of [['pointerdown',{target:{}}],['keydown',{key:'Escape'}],['scroll',{}]]){
    await w.click();w.environment.emit(type,event);assert.equal(visible(),false);assert.equal(w.timers.at(-1).cleared,true);
  }
  assert.equal(w.environment.listeners.get('scroll')[0].capture,true);
  w.unmount();
  assert.ok([...w.environment.listeners.values()].every(list=>list.length===0));
});
test('dismissal and unmount prevent delayed clipboard results from resurrecting a toast',async()=>{
  let finish;
  const w=await shareWidget({clipboard:{writeText:()=>new Promise(resolve=>{finish=resolve;})}},{desktop:true});
  const pending=w.click();w.environment.emit('scroll');finish();await pending;
  assert.ok(!w.render().some(n=>n.props?.role==='status'));assert.equal(w.timers.length,0);
  const next=w.click();w.unmount();finish();await next;assert.equal(w.timers.length,0);
  assert.ok([...w.environment.listeners.values()].every(list=>list.length===0));
  const active=await shareWidget({clipboard:{writeText:async()=>{}}});await active.click();active.unmount();
  assert.equal(active.timers[0].cleared,true);
});
