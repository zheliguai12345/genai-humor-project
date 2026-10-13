import Link from "next/link";
import { Photo } from "./photo";
import { VoteControls } from "./vote-controls";
import { stopCount, type JourneySummary, type VoteCounts } from "@/utils/journeys/presentation";

export function JourneyCard({ journey, counts = { up: 0, down: 0 }, currentVote = null, authenticated = false, privateView = false, linked = true }: {
  journey: JourneySummary & { stops?: unknown[] }; counts?: VoteCounts; currentVote?: "up" | "down" | null; authenticated?: boolean; privateView?: boolean; linked?: boolean;
}) {
  const href = journey.status === "draft" ? `/preview/${journey.id}` : `/journeys/${journey.id}`;
  return <article className="journey-card" aria-label={journey.title}>
    <div className="card-photo"><Photo photo={journey.cover_image} alt={`Atmosphere for ${journey.title}`} /></div>
    <div className="card-copy"><h2>{linked ? <Link className="card-link" href={href}>{journey.title}</Link> : journey.title}</h2>
      <p className="card-hook" title={journey.hook}>{journey.hook}</p><p className="card-meta"><span className="card-area" title={journey.area}>{journey.area}</span>{" "}<span>· {journey.budget_label} · {stopCount(journey)} stops</span></p>
      {privateView ? <span className="status-badge">{journey.status === "draft" ? "Draft" : "Published"}</span> : <VoteControls journeyId={journey.id} counts={counts} currentVote={currentVote} authenticated={authenticated} />}
    </div>
  </article>;
}
