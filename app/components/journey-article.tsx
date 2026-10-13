import Link from "next/link";
import type { Journey } from "@/utils/journeys/types";
import { mapsUrl, durationLabel, type VoteCounts } from "@/utils/journeys/presentation";
import { Photo } from "./photo";
import { VoteControls } from "./vote-controls";

export function JourneyStops({ journey }: { journey: Journey }) {
  return <><ol className="compact-stops" aria-label="Journey stops">{journey.stops.map(stop => <li key={stop.position} id={`stop-${stop.position}`}>
    <span className="stop-index">{String(stop.position).padStart(2, "0")}</span><div className="stop-copy"><h2>{stop.title}</h2>
      <p className="stop-place">{stop.place} <a href={mapsUrl(stop.place)} target="_blank" rel="noreferrer">Maps ↗</a></p>
      <p className="your-move"><strong>Your move</strong> {stop.move}</p>
      <details className="stop-more"><summary>More</summary><p className="hint">{stop.time_label}</p><p className="measure">{stop.body}</p></details>
    </div></li>)}</ol><p className="journey-ending">{journey.ending}</p></>;
}
export function JourneyArticle({ journey, voting }: {
  journey: Journey; voting: { authenticated: boolean; currentVote: "up" | "down" | null; counts: VoteCounts };
}) {
  return <><Link className="back-link" href="/">← Discover</Link><header className="compact-journey-header">
    <div className="detail-cover"><Photo photo={journey.cover_image} alt={`Atmosphere for ${journey.title}`} priority /></div>
    <div className="detail-heading"><h1>{journey.title}</h1><p className="detail-hook">{journey.hook}</p>
      <p className="detail-meta">{journey.area} · {journey.budget_label} · {durationLabel(journey)}</p>
      <VoteControls journeyId={journey.id} {...voting} /></div>
    </header><JourneyStops journey={journey} /></>;
}
