import Link from "next/link";
import { Photo } from "./photo";
import { durationLabel, type JourneySummary, type VoteCounts } from "@/utils/journeys/presentation";

export function JourneyList({ journeys, counts = {}, privateList = false }: {
  journeys: JourneySummary[]; counts?: Record<string, VoteCounts>; privateList?: boolean;
}) {
  return <div className="journey-list">{journeys.map((journey, index) => <article className="journey-row" key={journey.id}>
    <div className="row-photo"><Photo photo={journey.cover_image} alt={`Atmosphere for ${journey.title}`} /></div>
    <div className="row-copy">
      <div className="row-kicker"><span className="index-number">{String(index + 1).padStart(2, "0")}</span><span>{journey.kicker}</span>{privateList && <span className="status-badge">{journey.status === "draft" ? "Draft" : "Published"}</span>}</div>
      <h3><Link href={journey.status === "draft" ? `/preview/${journey.id}` : `/journeys/${journey.id}`}>{journey.title}<span className="row-arrow" aria-hidden="true">↗</span></Link></h3>
      <p className="row-hook" title={journey.hook}>{journey.hook}</p>
      <p className="row-description">{journey.premise}</p>
      <p className="row-meta"><span>{journey.area}</span><span>{durationLabel(journey)}</span><span>{journey.budget_label}</span>
        {!privateList && <span className="vote-tally">{counts[journey.id]?.up ?? 0} would do this</span>}</p>
    </div>
  </article>)}</div>;
}
