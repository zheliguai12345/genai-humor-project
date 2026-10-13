import Link from "next/link";
import { getDiscoverJourneys, getOwnJourneyVotes } from "@/utils/supabase/journeys";
import { getOptionalUser } from "@/utils/supabase/server";
import { JourneyCard } from "./components/journey-card";

export default async function Discover({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const sort = params.sort === "new" ? "new" : "top";
  const [data, user] = await Promise.all([getDiscoverJourneys(sort), getOptionalUser()]);
  const ownVotes = user ? await getOwnJourneyVotes(data.journeys.map(j => j.id)) : {};
  return <main id="main-content" className="discover-page"><section className="discover-intro" aria-labelledby="discover-heading"><div><h1 id="discover-heading">Ordinary New York. Extraordinary premises.</h1>
    <p>AI turns real NYC places into a themed day out. Vote on the ones you&apos;d actually do — or make your own.</p></div><Link className="button" href="/create">Make a journey →</Link></section>
    <nav className="feed-tabs" aria-label="Sort journeys"><Link href="/?sort=top" aria-current={sort === "top" ? "page" : undefined}>Top</Link><Link href="/?sort=new" aria-current={sort === "new" ? "page" : undefined}>New</Link></nav>
    <div className="journey-grid">{data.journeys.map(journey => <JourneyCard key={journey.id} journey={journey} counts={data.counts[journey.id]} currentVote={ownVotes[journey.id]} authenticated={!!user} creditOverlay />)}</div>
    {!data.journeys.length && <p className="empty-state">The next journey could be yours. <Link href="/create">Create one →</Link></p>}
  </main>;
}
