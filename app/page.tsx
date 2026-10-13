import Link from "next/link";
import { getDiscoverJourneys, getOwnJourneyVotes } from "@/utils/supabase/journeys";
import { getOptionalUser } from "@/utils/supabase/server";
import { JourneyCard } from "./components/journey-card";

export default async function Discover({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const sort = params.sort === "new" ? "new" : "top";
  const [data, user] = await Promise.all([getDiscoverJourneys(sort), getOptionalUser()]);
  const ownVotes = user ? await getOwnJourneyVotes(data.journeys.map(j => j.id)) : {};
  return <main id="main-content" className="discover-page"><h1 className="sr-only">Discover journeys</h1>
    {(params.signin || params.error) && <p className="notice" role={params.error ? "alert" : "status"}>{params.error ? "Sign-in didn't finish. Please try again." : "Sign in with Google above to continue."} <a href="#sign-in">Google sign-in ↑</a></p>}
    <nav className="feed-tabs" aria-label="Sort journeys"><Link href="/?sort=top" aria-current={sort === "top" ? "page" : undefined}>Top</Link><Link href="/?sort=new" aria-current={sort === "new" ? "page" : undefined}>New</Link></nav>
    <div className="journey-grid">{data.journeys.map(journey => <JourneyCard key={journey.id} journey={journey} counts={data.counts[journey.id]} currentVote={ownVotes[journey.id]} authenticated={!!user} />)}</div>
    {!data.journeys.length && <p className="empty-state">The next journey could be yours. <Link href="/create">Create one →</Link></p>}
  </main>;
}
