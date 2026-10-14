import Link from "next/link";
import { getDiscoverJourneys, getOwnJourneyVotes } from "@/utils/supabase/journeys";
import { getOptionalUser } from "@/utils/supabase/server";
import { JourneyCard } from "./components/journey-card";
import { LandingHero } from "./components/landing-hero";

export default async function Discover({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const sort = params.sort === "new" ? "new" : "top";
  const [data, user] = await Promise.all([getDiscoverJourneys(sort), getOptionalUser()]);
  const ownVotes = user ? await getOwnJourneyVotes(data.journeys.map(j => j.id)) : {};
  return <main id="main-content" className="discover-page landing-page"><LandingHero covers={data.filmstrip} />
    <section id="discover" className="discover-section" aria-labelledby="discover-heading"><h2 id="discover-heading">Discover</h2><p className="discover-subtitle">Journeys people actually want to do.</p>
    <nav className="feed-tabs" aria-label="Sort journeys"><Link href="/?sort=top#discover" aria-current={sort === "top" ? "page" : undefined}>Top</Link><Link href="/?sort=new#discover" aria-current={sort === "new" ? "page" : undefined}>New</Link></nav>
    <div className="journey-grid">{data.journeys.map(journey => <JourneyCard key={journey.id} journey={journey} counts={data.counts[journey.id]} currentVote={ownVotes[journey.id]} authenticated={!!user} creditOverlay truncateHook />)}</div>
    {!data.journeys.length && <p className="empty-state">The next journey could be yours. <Link href="/create">Create one →</Link></p>}
    </section></main>;
}
