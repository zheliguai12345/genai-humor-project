import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { moduleLoader, root } from '../tests/helpers/module-loader.mjs';

// Isolated, read-only presentation server. Never imports environment files or Supabase.
// Uses the real product components with a previously captured local sample, without hydration.
if (!process.argv.includes('--serve-local')) throw Error('Use --serve-local for isolated visual review.');
const sample = JSON.parse(await fs.readFile(path.join(root, 'docs/phase-3/visual-sample.json'), 'utf8'));
const cssFiles = (await fs.readdir(path.join(root, '.next/static/css'))).filter(f => f.endsWith('.css'));
const css = (await Promise.all(cssFiles.map(f => fs.readFile(path.join(root, '.next/static/css', f), 'utf8')))).join('\n');
const fontClasses = [...css.matchAll(/\.([\w-]+)\{--font-(?:geist-sans|editorial):/g)].map(m => m[1]).join(' ');
const dependencies = {
  react: React, 'react/jsx-runtime': jsx,
  'next/link': { default: ({children, ...props}) => React.createElement('a', props, children) },
  'next/navigation': { useRouter: () => ({push(){throw Error('Visual review is read-only.');},refresh(){}}) },
  '@/app/journey-actions': {
    createJourney(){throw Error('Visual review cannot generate.');},
    publishJourney(){throw Error('Visual review cannot publish.');},
  },
};
const { CreateForm } = await moduleLoader('app/create/create-form.tsx', dependencies, {});
const { PreviewEditor } = await moduleLoader('app/preview/[id]/preview-editor.tsx', dependencies, {});
const e = React.createElement;
const create = e('main',{id:'main-content',className:'create-page'},
  e('header',{className:'page-heading'},e('p',{className:'section-label'},'A day that only you could invent'),
    e('h1',null,'Start somewhere',e('br'),e('span',null,'unexpected.')),
    e('p',{className:'measure'},'A wild idea, a few real places, and a reason to look twice. Your journey starts as a private draft. You decide what gets published.')),
  e(CreateForm,{initialQuota:{remaining:6,resets_at:'2026-10-14T00:00:00.000Z'}}));
const preview = e('main',{id:'main-content',className:'journey-page preview-editor'},e(PreviewEditor,{journey:sample}));
function document(name,content) {
  return '<!doctype html>'+renderToStaticMarkup(e('html',{lang:'en',className:fontClasses},
    e('head',null,e('meta',{name:'viewport',content:'width=device-width, initial-scale=1'}),e('title',null,`${name} — Local visual review`),
      ...cssFiles.map(f=>e('link',{key:f,rel:'stylesheet',href:`/_next/static/css/${f}`}))),
    e('body',null,e('a',{className:'skip-link',href:'#main-content'},'Skip to content'),
      e('header',{className:'site-header'},e('div',{className:'header-inner'},
        e('a',{className:'wordmark',href:'http://localhost:3001/'},'Elsewhere',e('span',null,', NYC.')),
        e('nav',{'aria-label':'Main navigation',className:'site-nav'},
          ...[['Discover','http://localhost:3001/'],['Create','/visual/create'],['Profile','http://localhost:3001/profile']].map(([label,href])=>e('a',{key:label,href,'aria-current':name===label?'page':undefined},label))),
        e('span',{className:'header-account'},'Local visual review'))),
      e('aside',{className:'notice',style:{maxWidth:'1100px',margin:'24px auto',padding:'16px'}},'Read-only component preview · Local sample · Authentication and publishing are not exercised here.'),
      content,e('footer',{className:'site-footer'},e('div',null,e('a',{className:'footer-brand',href:'http://localhost:3001/'},'Elsewhere, NYC.'),e('p',null,'One city. A thousand ways to live it.')),
        e('a',{href:'http://localhost:3001/privacy'},'Privacy & your data'),e('span',null,'Made for a day outside.')))));
}
const pages={'/visual/create':document('Create',create),'/visual/preview':document('Preview',preview)};
http.createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'){res.writeHead(405);res.end('Read-only');return;}
    const url=new URL(req.url,'http://localhost:3003');
    if(url.search){res.writeHead(403);res.end('Visual review does not submit forms.');return;}
    if(url.pathname in pages){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(pages[url.pathname]);return;}
    const filename=path.resolve(root,'.next',url.pathname.replace(/^\/_next\//,''));
    if(!url.pathname.startsWith('/_next/static/')||!filename.startsWith(path.join(root,'.next/static')+path.sep)){res.writeHead(404);res.end();return;}
    const types={'.css':'text/css','.woff2':'font/woff2','.woff':'font/woff'};
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]??'application/octet-stream'});res.end(await fs.readFile(filename));
  }catch{res.writeHead(500);res.end('Visual review unavailable.');}
}).listen(3003,'127.0.0.1',()=>console.log('Read-only component review: http://localhost:3003/visual/create and /visual/preview'));
