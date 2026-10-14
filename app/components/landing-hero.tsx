import Link from "next/link";
import type { JourneySummary } from "@/utils/journeys/presentation";
import { unsplashUrl } from "@/utils/journeys/presentation";

function Filmstrip({ covers, reverse = false }: { covers: JourneySummary[]; reverse?: boolean }) {
  return <div className={`hero-filmstrip${reverse ? " hero-filmstrip-reverse" : ""}`} aria-hidden="true">
    <div className="filmstrip-track">{[0, 1].map(copy => <div className="filmstrip-reel" key={copy}>{covers.map(journey => <div className="filmstrip-frame" key={journey.id}>
      {/* Preload the moving reel on desktop; hidden mobile films use a transparent pixel. */}
      <picture><source media="(min-width: 901px)" srcSet={journey.cover_image!.url} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="" width={400} height={500} loading="eager" decoding="async" />
      </picture>
      <span>{journey.title}</span>
    </div>)}</div>)}</div>
  </div>;
}

export function LandingHero({ covers }: { covers: JourneySummary[] }) {
  const photographs = covers.filter(journey => journey.status === "published" && journey.cover_image?.url);
  return <section className="landing-hero" aria-labelledby="landing-heading">
    <Filmstrip covers={photographs} />
    <div className="hero-copy"><p className="hero-eyebrow">Themed day-outs in real New York</p>
      <h1 id="landing-heading">This weekend, live a different story.</h1>
      <p className="hero-lede">AI invents the premise. Ordinary New York becomes the set.</p>
      <ol className="hero-steps">
        <li><h2><span>1</span> Pick a premise</h2><p>AI turns ordinary NYC spots into a themed half-day: a witch&apos;s errand, a time machine, your last day on Earth.</p></li>
        <li><h2><span>2</span> See the route</h2><p>3–5 real stops, each with one small thing to do there.</p></li>
        <li><h2><span>3</span> Vote</h2><p>▲ upvote the ones worth doing. Or <Link href="/create">make your own</Link>.</p></li>
      </ol>
      <div className="hero-actions"><a className="button" href="#discover">Browse journeys ↓</a><Link className="button secondary" href="/create">Make one →</Link></div>
      <a className="hero-scroll" href="#discover">Scroll <span aria-hidden="true">↓</span></a>
      <p className="hero-photo-credit">Covers via <a href={unsplashUrl()} target="_blank" rel="noreferrer">Unsplash</a> · photographers credited on each journey</p>
    </div>
    <Filmstrip covers={[...photographs].reverse()} reverse />
  </section>;
}
