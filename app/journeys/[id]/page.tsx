import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedJourney, getJourneyVoteCounts, getOwnJourneyVote } from "@/utils/supabase/journeys";
import { getOptionalUser } from "@/utils/supabase/server";
import { JourneyInputError } from "@/utils/journeys/validation";
import { JourneyArticle } from "@/app/components/journey-article";
import { VoteControls } from "@/app/components/vote-controls";

const readJourney = cache(async (id: string) => {
  try { return await getPublishedJourney(id); } catch (error) { if (error instanceof JourneyInputError) return null; throw error; }
});
export async function generateMetadata({ params }: PageProps<"/journeys/[id]">): Promise<Metadata> {
  const journey = await readJourney((await params).id);
  return journey ? { title: journey.title, description: journey.hook } : { title: "Journey not found" };
}
export default async function JourneyPage({ params }: PageProps<"/journeys/[id]">) {
  const { id } = await params;
  const journey = await readJourney(id);
  if (!journey) notFound();
  const user = await getOptionalUser();
  const [counts, ownVote] = await Promise.all([getJourneyVoteCounts(id), user ? getOwnJourneyVote(id) : Promise.resolve(null)]);
  return <main id="main-content" className="journey-page"><JourneyArticle journey={journey} /><VoteControls journeyId={id} authenticated={!!user} currentVote={ownVote?.value ?? null} counts={counts} /></main>;
}
