import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { mapQuery } from '../utils/journeys/maps.ts';
import { readUnsplashPhoto, unsplashResponseMetadata, validDownloadLocation } from '../utils/ai/unsplash-response.ts';

const DELETE_TARGETS = [
  {id:'17395993-cae7-47a8-b682-cdfe72d63a47',title:'Low Life, High Voltage'},
  {id:'3b576f6b-525b-4b2e-ae75-a0b0d58c1208',title:'The Major Arcana of the West Side'},
];
export const QUOTA_RESERVE = 5;
const fail = message => { throw new Error(message); };

export function imageTargets(journeys) {
  const rows = [];
  for (const journey of journeys.filter(j => j.status === 'published').sort((a,b) => a.id.localeCompare(b.id))) {
    const stops = [...journey.journey_stops].sort((a,b) => a.position-b.position);
    const add = (position, place) => {
      if (!place?.trim()) fail('A missing photo has no source place; review the Journey first.');
      rows.push({ journey_id: journey.id, journey_title: journey.title, position, place,
        search_query: `${mapQuery(place, { preferAddress: false }).replace(/, New York City$/, '')} New York` });
    };
    if (journey.cover_image === null) add(0, stops[0]?.place);
    for (const stop of stops) if (stop.image === null) add(stop.position, stop.place);
  }
  return rows;
}

async function published(db) {
  const rows = [];
  for (let start=0; start<10_000; start+=100) {
    const result = await db.from('journeys').select('id,title,status,cover_image,journey_stops(position,place,image)')
      .eq('status','published').order('id').range(start,start+99);
    if (result.error) fail('Unable to read published Journeys.');
    rows.push(...result.data);
    if (result.data.length<100) return rows;
  }
  fail('Too many Journeys for this one-time operation.');
}
async function deletionPlan(db,target) {
  const result = await db.from('journeys').select('id,title,status,is_editorial').eq('id',target.id).maybeSingle();
  if (result.error) fail('Unable to inspect the requested deletion.');
  if (!result.data) return null;
  if (result.data.title !== target.title || result.data.status !== 'published' || result.data.is_editorial) fail('The requested deletion target no longer matches.');
  const counts = {};
  for (const table of ['journey_stops','journey_votes','generation_runs']) {
    const count = await db.from(table).select('*',{count:'exact',head:true}).eq('journey_id',target.id);
    if (count.error || count.count === null) fail('Unable to count deletion effects.');
    counts[table] = count.count;
  }
  return { ...target, journeys:1, stops:counts.journey_stops, votes:counts.journey_votes,
    generation_runs_detached:counts.generation_runs };
}

export function quotaProvider(key, fetcher=fetch, log=console.info) {
  let remaining=null, requests=0, healthy=false;
  const request = async (url, operation, needed=1) => {
    if (operation!=='quota' && (remaining===null || remaining<QUOTA_RESERVE+needed)) fail('Insufficient known Unsplash quota; stopped without retry.');
    const response = await fetcher(url, { headers:{Authorization:`Client-ID ${key}`,'Accept-Version':'v1'},
      redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10_000) });
    requests++;
    const metadata=unsplashResponseMetadata(response);
    healthy=response.ok;
    remaining=metadata.rate_remaining===null ? null : Math.min(metadata.rate_remaining,remaining===null?Infinity:remaining-1);
    log('Unsplash HTTP',JSON.stringify({operation,...metadata,requests}));
    if (!response.ok && operation!=='quota') fail(`Unsplash HTTP ${metadata.http_status}; stopped without retry.`);
    return response;
  };
  const searchUrl = query => {
    const url=new URL('https://api.unsplash.com/search/photos');
    url.search=new URLSearchParams({query,per_page:'1',content_filter:'high'}).toString();return url;
  };
  return {
    async probe() { const response=await request(searchUrl('New York'),'quota'); return {...unsplashResponseMetadata(response),requests}; },
    requireBudget(images) { if (!healthy || remaining===null || remaining<images*2+QUOTA_RESERVE) fail('Insufficient Unsplash quota for the approved batch; no images written.'); },
    requireTracking() { if (!healthy || remaining===null || remaining<QUOTA_RESERVE+1) fail('Insufficient Unsplash quota to track a photo; no image written.'); },
    async search(query) { const response=await request(searchUrl(query),'search',2); return readUnsplashPhoto((await response.json()).results?.[0]); },
    async track(location) { if(!validDownloadLocation(location)) fail('Invalid Unsplash download location.'); await request(location,'download'); },
    stats() { return {remaining,requests}; },
  };
}

export async function repairImages(rows, {provider,save,exists,log=console.info}) {
  if (!rows.length) return {updated:0,skipped:0};
  await provider.probe(); provider.requireBudget(rows.length);
  let updated=0,skipped=0;
  for (const row of rows) {
    if (!await exists(row)) { skipped++; continue; }
    const photo=await provider.search(row.search_query);
    if (!photo) { skipped++; log('No photo result',JSON.stringify({journey_id:row.journey_id,position:row.position}));continue; }
    // Reserve the single required tracking request before saving a public photograph.
    provider.requireTracking();
    if (!await save(row,{...photo,candidates:[photo]})) { skipped++;continue; }
    updated++;
    await provider.track(photo.download_location);
    log('Photo repaired',JSON.stringify({journey_id:row.journey_id,position:row.position}));
  }
  return {updated,skipped,...provider.stats()};
}
async function savePhoto(db,row,image) {
  const cover=row.position===0, column=cover?'cover_image':'image';
  let query=db.from(cover?'journeys':'journey_stops').update({[column]:image});
  query=cover ? query.eq('id',row.journey_id).eq('status','published') : query.eq('journey_id',row.journey_id).eq('position',row.position);
  // Existing generation records may use either SQL NULL or JSON null.
  const result=await query.or(`${column}.is.null,${column}.eq.null`).select(cover?'id':'journey_id,position');
  if (result.error) fail('Photo update failed; stopped without retry.');
  return result.data.length===1;
}
export async function deleteReviewedJourney(db,approved) {
  const target=DELETE_TARGETS.find(target=>target.id===approved?.id && target.title===approved?.title);
  if(!target) fail('Deletion is limited to the two requested test Journeys.');
  const current=await deletionPlan(db,target);
  if (!approved || JSON.stringify(current)!==JSON.stringify(approved)) fail('Deletion counts changed; obtain a new review before deleting.');
  const result=await db.from('journeys').delete().eq('id',target.id).eq('title',target.title).eq('status','published').eq('is_editorial',false).select('id');
  if(result.error || result.data.length!==1) fail('Journey deletion did not complete.');
  // Existing foreign keys cascade stops/votes and preserve generation history with journey_id=NULL.
  return current;
}

async function main() {
  const args=process.argv.slice(2), allowed=new Set(['--dry-run','--plan','--apply-images','--delete-approved-journeys','--database-only']);
  let planPath='/tmp/elsewhere-image-repair-plan.json';
  for(let i=0;i<args.length;i++) {
    if(!allowed.has(args[i])) fail('Unknown maintenance option.');
    if(args[i]==='--plan') { if(!args[i+1]) fail('Missing plan path.');planPath=args[++i]; }
  }
  const apply=args.includes('--apply-images'), remove=args.includes('--delete-approved-journeys');
  if((args.includes('--dry-run')||args.includes('--database-only'))&&(apply||remove)) fail('Dry-run cannot be combined with writes.');
  const {loadEnvConfig}=createRequire(import.meta.url)('@next/env');
  loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const {createClient}=await import('@supabase/supabase-js');
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY || !process.env.UNSPLASH_ACCESS_KEY) fail('Maintenance environment is not configured.');
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15_000)})}});
  const provider=quotaProvider(process.env.UNSPLASH_ACCESS_KEY);
  if(!apply&&!remove) {
    const journeys=await published(db),rows=imageTargets(journeys),deletions=[];
    for(const target of DELETE_TARGETS) deletions.push(await deletionPlan(db,target));
    const quota=args.includes('--database-only')?null:await provider.probe();
    const plan={version:1,created_at:new Date().toISOString(),published_journeys:journeys.length,rows,deletions,quota,
      max_image_api_requests:rows.length?1+rows.length*2:0,quota_reserve:QUOTA_RESERVE};
    await writeFile(planPath,JSON.stringify(plan,null,2)+'\n');
    console.info(JSON.stringify({mode:'dry-run',...plan},null,2));return;
  }
  // Write modes require a reviewed on-disk dry-run plan and separate user approval.
  const approved=JSON.parse(await readFile(planPath,'utf8'));
  if(approved.version!==1 || !Array.isArray(approved.rows)) fail('Invalid reviewed plan.');
  if(remove) {
    if(!Array.isArray(approved.deletions) || approved.deletions.length!==DELETE_TARGETS.length) fail('Invalid reviewed deletion plan.');
    // Check all counts before the first delete; each row is checked again immediately before deletion.
    for(let i=0;i<DELETE_TARGETS.length;i++) if(JSON.stringify(await deletionPlan(db,DELETE_TARGETS[i]))!==JSON.stringify(approved.deletions[i])) fail('Deletion counts changed; obtain a new review before deleting.');
    for(const deletion of approved.deletions) console.info('Deleted reviewed Journey',JSON.stringify(await deleteReviewedJourney(db,deletion)));
  }
  if(apply) {
    const current=imageTargets(await published(db));
    const rows=approved.rows.filter(row=>current.some(candidate=>JSON.stringify(candidate)===JSON.stringify(row)));
    console.info('Image repair result',JSON.stringify(await repairImages(rows,{provider,save:(row,image)=>savePhoto(db,row,image),
      exists:async row=>{const result=await db.from('journeys').select('id').eq('id',row.journey_id).eq('status','published').maybeSingle();if(result.error)fail('Unable to recheck publication.');return !!result.data;}})));
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(error instanceof Error && !/https?:|key|token|secret|credential/i.test(error.message)?error.message:'Maintenance failed; credentials are never logged.');process.exitCode=1;});
}
