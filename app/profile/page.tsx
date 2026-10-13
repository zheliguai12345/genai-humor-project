import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentProfile } from "@/utils/supabase/profile";
import { getOwnJourneys } from "@/utils/supabase/journeys";
import { JourneyCard } from "../components/journey-card";
import { ProfileForm } from "./profile-form";
export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };
export default async function ProfilePage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/?signin=profile&next=%2Fprofile");
  const journeys = await getOwnJourneys();
  return <main id="main-content" className="profile-page"><h1 className="sr-only">Profile</h1><ProfileForm profile={current.profile} avatarUrl={current.avatarUrl} />
    <section aria-labelledby="your-journeys-title"><h2 id="your-journeys-title" className="profile-journeys-title">Your journeys</h2><div className="journey-grid">{journeys.map(journey => <JourneyCard key={journey.id} journey={journey} privateView />)}</div>
      {!journeys.length && <p className="empty-state">Your first journey starts in Create.</p>}{journeys.length === 100 && <p className="hint">Showing your latest 100 journeys.</p>}</section>
  </main>;
}
