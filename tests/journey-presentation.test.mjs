import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/module-loader.mjs';

test('Maps and photographer links preserve place text and the required referral attribution',async()=>{
  const p=await moduleLoader('utils/journeys/presentation.ts');
  const place='Greene Street, Canal & Grand St';
  const url=new URL(p.mapsUrl(place));
  assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('api'),'1');assert.equal(url.searchParams.get('query'),place+', New York, NY');
  for(const href of [p.unsplashUrl('a photographer'),p.unsplashUrl()]){
    const credit=new URL(href);assert.equal(credit.origin,'https://unsplash.com');assert.equal(credit.searchParams.get('utm_source'),'elsewhere_nyc');assert.equal(credit.searchParams.get('utm_medium'),'referral');
  }
});
test('duration labels handle shared PM suffixes, AM-to-PM windows, and midnight without inventing route estimates',async()=>{
  const p=await moduleLoader('utils/journeys/presentation.ts');
  for(const [when_label,expected] of [['Saturday · 1–4 PM','3 hr'],['Sunday · 10 AM – 4 PM','6 hr'],['Saturday · 6 PM – midnight','6 hr'],['Friday · 7:00 – 10:15 PM','3 hr 15 min'],['Any afternoon','Any afternoon']])assert.equal(p.durationLabel({when_label,mode:'Walking'}),expected);
});
test('quota reset uses the same UTC calendar boundary as the database and shows a New York time label',async()=>{
  const p=await moduleLoader('utils/journeys/presentation.ts');
  const window=p.quotaWindow(new Date('2026-10-13T23:59:59Z'));
  assert.equal(window.starts_at,'2026-10-13T00:00:00.000Z');assert.equal(window.resets_at,'2026-10-14T00:00:00.000Z');assert.match(p.resetLabel(window.resets_at),/Oct 13.*8:00/);
});
test('all design text color pairs meet the requested 4.5:1 contrast, including selection and disabled states',()=>{
  function luminance(hex){const rgb=hex.match(/\w\w/g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
  for(const [foreground,background] of [['21392e','f7f5ee'],['5b6258','f7f5ee'],['85432a','f7f5ee'],['fffdf8','21392e'],['5b6258','eceee4'],['21392e','e6ece1'],['60675c','fffdf8'],['842c22','eceee4']]){
    const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
    assert.ok((values[0]+.05)/(values[1]+.05)>=4.5,`${foreground} on ${background}`);
  }
});
