import Link from "next/link";
import { getDiscoverJourneys } from "@/utils/supabase/journeys";
import { JourneyList } from "./components/journey-list";

export default async function Discover({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const data = await getDiscoverJourneys();
  return <main id="main-content" className="discover-page">
    {(params.signin || params.error) && <aside className="notice sign-in-notice" role={params.error ? "alert" : "status"}>
      <strong>{params.error ? "Sign-in didn't finish." : "A little adventure starts with signing in."}</strong>
      <p>{params.error ? "Please try Google sign-in again." : "Use Google sign-in above to create a journey, preview your drafts, or add your vote."} <a href="#sign-in">Go to sign-in ↑</a></p>
    </aside>}
    <header className="discover-hero"><div><p className="section-label">A journal for the city you thought you knew</p><h1>One city.<br /><span>A thousand ways</span><br />to live it.</h1></div>
      <div className="hero-note"><span className="compass-mark" aria-hidden="true">↗</span><p>Ordinary places.<br />Extraordinary premises.</p><p className="hint">A last day on earth. An imaginary museum. A fortune spent one dollar at a time. Pick a story, then step into it.</p><Link className="button" href="/create">Make a day of it <span aria-hidden="true">→</span></Link></div>
    </header>
    <section className="feed-section" aria-labelledby="editors-heading"><div className="section-heading"><div><p className="section-label">01 / The opening issue</p><h2 id="editors-heading">Editor&apos;s picks</h2></div><p>Four ways to see the familiar differently.</p></div>
      {data.editorial.length ? <JourneyList journeys={data.editorial} counts={data.counts} /> : <p className="empty-state">The editors are putting the next issue together. Check back soon.</p>}
    </section>
    <section className="feed-section" aria-labelledby="favorites-heading"><div className="section-heading"><div><p className="section-label">02 / The reader&apos;s choice</p><h2 id="favorites-heading">Community favorites</h2></div><p>The days people would actually do.</p></div>
      {data.favorites.length ? <JourneyList journeys={data.favorites} counts={data.counts} /> : <div className="empty-state"><span aria-hidden="true">↗</span><div><h3>A favorite has to start somewhere.</h3><p>Journeys rise here when readers say “I&apos;d do this.” Find a day you like and cast the first vote.</p><Link href="/create">Create a journey →</Link></div></div>}
    </section>
    <section className="feed-section" aria-labelledby="new-heading"><div className="section-heading"><div><p className="section-label">03 / Freshly published</p><h2 id="new-heading">New from the community</h2></div><p>A city magazine with room for your point of view.</p></div>
      {data.latest.length ? <JourneyList journeys={data.latest} counts={data.counts} /> : <div className="empty-state"><span aria-hidden="true">E.</span><div><h3>The next issue is yours.</h3><p>Give us a wild idea. Preview the result. Publish it when it feels like a day worth sharing.</p><Link href="/create">Start with a theme →</Link></div></div>}
    </section>
  </main>;
}
