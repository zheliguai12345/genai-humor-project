"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Journey } from "@/utils/journeys/types";
import { publishJourney } from "@/app/journey-actions";
import { JourneyCard } from "@/app/components/journey-card";
import { JourneyStops } from "@/app/components/journey-article";
import { RouteMap } from "@/app/components/route-map";

export function PreviewEditor({ journey }: { journey: Journey }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  const router = useRouter();
  function publish() {
    if (locked.current) return;
    locked.current = true; setError("");
    startTransition(async () => {
      try {
        // Only stored candidate indices go to the existing transaction. Null images need a null index.
        const selections = [{ position: 0, candidate_index: journey.cover_image ? 0 : null },
          ...journey.stops.map(stop => ({ position: stop.position, candidate_index: stop.image ? 0 : null }))];
        const result = await publishJourney(journey.id, selections);
        if (result.error) setError(result.error);
        else { router.push("/?sort=new#discover"); router.refresh(); }
      } catch { setError("Couldn't publish. Your draft is safe. Please try again."); }
      finally { locked.current = false; }
    });
  }
  return <><h1 className="sr-only">Preview your journey</h1><div className="preview-layout"><div className="preview-card"><JourneyCard journey={journey} privateView linked={false} /><RouteMap journey={journey} /></div><div><JourneyStops journey={journey} /></div></div>
    <div className="publish-buttons"><button className="button" type="button" disabled={pending} onClick={publish}>{pending ? "Publishing…" : "Publish"}</button>
      <Link className="button secondary" href="/create" aria-disabled={pending} onClick={e => { if (pending) e.preventDefault(); }}>Try again</Link></div>
    {error && <p role="alert" className="notice error-notice">{error}</p>}
  </>;
}
