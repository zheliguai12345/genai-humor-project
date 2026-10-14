import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
export const root = path.resolve(import.meta.dirname, '../..');

// Executes the actual TS/TSX module with explicit dependency and environment injection.
export async function moduleLoader(file, dependencies = {}, env = {
  SUPABASE_SECRET_KEY:'isolated-test', GEMINI_MODEL:'isolated-model', GEMINI_API_KEY:'isolated-test', UNSPLASH_ACCESS_KEY:'isolated-test',
}) {
  const context = vm.createContext({process:{env},AbortSignal:dependencies.AbortSignal??AbortSignal,URL,URLSearchParams,crypto:webcrypto,fetch:dependencies.fetch,window:dependencies.window,navigator:dependencies.navigator,Map,Set,
    console:dependencies.console??{warn(){}},setTimeout:dependencies.setTimeout??setTimeout,clearTimeout:dependencies.clearTimeout??clearTimeout,Response,ReadableStream,TextEncoder,TextDecoder});
  const cache=new Map();
  async function load(filename){
    if(cache.has(filename))return cache.get(filename);
    const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,resolveJsonModule:true}}).outputText;
    const mod=new vm.SourceTextModule(source,{context});cache.set(filename,mod);
    await mod.link(async specifier=>{
      if(specifier in dependencies||specifier==='server-only'){
        const exports=dependencies[specifier]??{};
        return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});
      }
      const resolved=specifier.startsWith('@/')?path.join(root,specifier.slice(2)):path.resolve(path.dirname(filename),specifier);
      if(specifier.endsWith('.json'))return new vm.SyntheticModule(['default'],function(){this.setExport('default',JSON.parse(fs.readFileSync(resolved,'utf8')));},{context});
      const target=[resolved,resolved+'.ts',resolved+'.tsx'].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
      if(!target)throw Error(`Provide an isolated dependency for ${specifier}`);
      return load(target);
    });return mod;
  }
  const mod=await load(path.join(root,file));await mod.evaluate();return mod.namespace;
}
