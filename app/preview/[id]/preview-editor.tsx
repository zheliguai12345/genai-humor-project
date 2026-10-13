"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Journey, JourneyImage } from "@/utils/journeys/types";
import { publishJourney } from "@/app/journey-actions";
import { JourneyArticle } from "@/app/components/journey-article";
import { Photo, PhotoCredit } from "@/app/components/photo";

function CandidatePicker({ image, selected, change, alt, disabled }: { image: JourneyImage | null; selected: number | null; change: (i: number) => void; alt: string; disabled: boolean }) {
  const [failed, setFailed] = useState<number[]>([]);
  if (!image) return <><Photo photo={null} alt={alt} /><p className="candidate-note">No photograph found. This position will use a typographic placeholder.</p></>;
  const photo = image.candidates[selected ?? 0];
  return <><Photo key={photo.url} photo={photo} alt={alt} /><div className="candidate-gallery" aria-label={`Photo choices for ${alt}`}>
    {image.candidates.map((candidate,index)=><figure key={candidate.url}><button type="button" aria-label={`Select photograph ${index+1} by ${candidate.photographer_name}`} aria-pressed={selected===index} disabled={disabled} onClick={()=>change(index)}>
      {failed.includes(index) ? <span className="candidate-note">Photo unavailable</span> :
        // eslint-disable-next-line @next/next/no-img-element
        <img src={candidate.url} alt={`Photograph ${index+1} for ${alt}`} width={100} height={100} loading="lazy" onError={()=>setFailed(f=>[...f,index])} />}
      <span>{selected===index?"Selected":`Option ${index+1}`}</span></button><PhotoCredit photo={candidate} /></figure>)}
  </div><p className="candidate-note">Choose the photograph that fits your story.</p></>;
}
export function PreviewEditor({ journey }: { journey: Journey }) {
  const positions = [{ position:0, image:journey.cover_image }, ...journey.stops.map(s=>({position:s.position,image:s.image}))];
  const [selection,setSelection] = useState<Record<number,number|null>>(()=>Object.fromEntries(positions.map(p=>[p.position,p.image?0:null])));
  const [error,setError] = useState("");
  const [pending,startTransition] = useTransition();
  const locked = useRef(false);
  const router = useRouter();
  function publish() {
    if (locked.current) return;
    locked.current=true;setError("");
    startTransition(async()=>{
      try {
        const result=await publishJourney(journey.id,positions.map(p=>({position:p.position,candidate_index:selection[p.position]})));
        if(result.error)setError(result.error);
        else {router.push(`/journeys/${journey.id}`);router.refresh();}
      } catch {setError("We couldn't publish your journey. Your draft is still here. Please try again.");}
      finally{locked.current=false;}
    });
  }
  return <><aside className="notice preview-notice"><div><strong>Just for you, for now.</strong><p>Read the route, choose your photographs, and check the real-world details before publishing.</p></div><span className="status-badge">Private draft</span></aside>
    <JourneyArticle journey={journey} preview renderPhoto={(position,image,alt)=><CandidatePicker image={image} alt={alt} selected={selection[position]} change={index=>setSelection(s=>({...s,[position]:index}))} disabled={pending} />} />
    <section className="publish-panel" aria-labelledby="publish-title"><div><h2 id="publish-title">A day worth putting out into the world?</h2><p>Publish makes this journey visible to everyone. Until then, it stays in Your journeys.</p></div><div className="publish-buttons"><button className="button" type="button" disabled={pending} onClick={publish}>{pending?"Publishing…":"Publish journey"}<span aria-hidden="true">↗</span></button><Link className="button secondary" href="/create" aria-disabled={pending} onClick={e=>{if(pending)e.preventDefault();}}>Generate another</Link></div></section>
    {error&&<p role="alert" className="notice error-notice">{error}</p>}
  </>;
}
