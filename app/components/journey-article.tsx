import Link from "next/link";
import type { ReactNode } from "react";
import type { Journey, JourneyImage } from "@/utils/journeys/types";
import { mapsUrl } from "@/utils/journeys/presentation";
import { Photo } from "./photo";

export function JourneyArticle({ journey, preview = false, renderPhoto }: {
  journey: Journey; preview?: boolean; renderPhoto?: (position: number, image: JourneyImage | null, alt: string) => ReactNode;
}) {
  const media = (position: number, image: JourneyImage | null, alt: string) => renderPhoto ? renderPhoto(position, image, alt) : <Photo photo={image} alt={alt} priority={position === 0} />;
  return <>
    <Link className="back-link" href="/">← Back to Discover</Link>
    <header className="journey-heading">
      <div><p className="section-label">{preview ? "Your unpublished journey" : journey.is_editorial ? "From the editors" : "From the community"} <span aria-hidden="true">/</span> {journey.kicker}</p>
        <h1>{journey.title}</h1><p className="journey-hook">{journey.hook}</p><p className="measure">{journey.premise}</p></div>
      <div className="cover-photo">{media(0, journey.cover_image, `Atmosphere for ${journey.title}`)}</div>
    </header>
    <dl className="journey-facts">{[["When",journey.when_label],["Budget",journey.budget_label],["Neighborhood",journey.area],["On the ground",journey.mode]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <section className="route-overview" aria-labelledby="route-title">
      <div className="section-heading"><h2 id="route-title">The route, at a glance</h2><span>{journey.stops.length} stops / one small adventure</span></div>
      <ol>{journey.stops.map(stop => <li key={stop.position}><span className="route-number" aria-hidden="true">{String(stop.position).padStart(2,"0")}</span><div><a href={`#stop-${stop.position}`}>{stop.title}</a><p>{stop.place}</p></div></li>)}</ol>
    </section>
    <section className="journey-stops" aria-label="Journey stops">{journey.stops.map(stop => <article className="stop-row" id={`stop-${stop.position}`} key={stop.position}>
      <div className="stop-photo">{media(stop.position, stop.image, `Atmosphere for ${stop.place}`)}</div>
      <div className="stop-copy"><p className="stop-number">Stop {String(stop.position).padStart(2,"0")}</p><h2>{stop.title}</h2>
        <p className="stop-location"><span>{stop.time_label}</span><span>{stop.place}</span></p>
        <a className="maps-link" href={mapsUrl(stop.place)} target="_blank" rel="noreferrer">Open in Maps <span aria-hidden="true">↗</span></a>
        <p className="measure">{stop.body}</p><p className="your-move"><strong>Your move</strong><span>{stop.move}</span></p></div>
    </article>)}</section>
    <div className="journey-ending"><span aria-hidden="true">E.</span><p>{journey.ending}</p></div>
  </>;
}
