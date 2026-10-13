import Link from "next/link";
import { Photo } from "./photo";
import { VoteControls } from "./vote-controls";
import { stopCount, type JourneySummary, type VoteCounts } from "@/utils/journeys/presentation";

export function JourneyCard({ journey, counts = { up: 0, down: 0 }, currentVote = null, authenticated = false, privateView = false, linked = true, creditOverlay = false }: {
  journey: JourneySummary & { stops?: unknown[] }; counts?: VoteCounts; currentVote?: "up" | "down" | null; authenticated?: boolean; privateView?: boolean; linked?: boolean; creditOverlay?: boolean;
}) {
  const href = journey.status === "draft" ? `/preview/${journey.id}` : `/journeys/${journey.id}`;
  return <article className="journey-card" aria-label={journey.title}>
    <div className="card-photo"><Photo photo={journey.cover_image} alt={`Atmosphere for ${journey.title}`} href={linked ? href : undefined} creditMode={creditOverlay ? "overlay" : "inline"} /></div>
    <div className="card-copy"><h2>{linked ? <Link className="card-link" href={href}>{journey.title}</Link> : journey.title}</h2>
      <p className="card-hook">{journey.hook}</p><p className="card-meta">{journey.area} · {journey.budget_label} · {stopCount(journey)} stops</p>
      {privateView ? <span className="status-badge">{journey.status === "draft" ? "Draft" : "Published"}</span> : <VoteControls journeyId={journey.id} counts={counts} currentVote={currentVote} authenticated={authenticated} />}
    </div>
  </article>;
}
