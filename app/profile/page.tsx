import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentProfile } from "@/utils/supabase/profile";
import { getOwnJourneys } from "@/utils/supabase/journeys";
import { needsNames } from "@/utils/profile";
import { JourneyList } from "../components/journey-list";
import { ProfileForm } from "./profile-form";
export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };
export default async function ProfilePage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/?signin=profile&next=%2Fprofile");
  const journeys = await getOwnJourneys();
  return <main id="main-content">
    <header className="page-heading"><p className="section-label">Your corner of the city</p><h1>Profile</h1><p>Your name, your photograph, your next small adventure.</p></header>
    <div className="profile-layout"><section className="profile-card"><h2>The person behind the premise</h2>
      {needsNames(current.profile) && <p role="status" className="notice">Welcome! You can add your first and last name here. You can already create and vote on journeys.</p>}
      {current.avatarUrl && <div className="avatar">
        {/* Private Storage signed URLs change on every render. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.avatarUrl} alt="Your profile photo" width={96} height={96} />
      </div>}
      <ProfileForm profile={current.profile} />
    </section><aside className="profile-story"><h2>Keep a day for yourself.<br />Share another.</h2><p>Drafts stay private. Published journeys become part of Elsewhere, NYC. You can return to any draft whenever the city calls.</p><Link className="button" href="/create">Create a journey →</Link></aside></div>
    <section aria-labelledby="your-journeys-title"><div className="section-heading"><h2 id="your-journeys-title">Your journeys</h2><p>Drafts and days you&apos;ve shared.</p></div>{journeys.length ? <><JourneyList journeys={journeys} privateList />{journeys.length === 100 && <p className="hint">Showing your latest 100 journeys.</p>}</> : <div className="empty-state"><span aria-hidden="true">↗</span><div><h3>Your first story is still out there.</h3><p>Start with a theme, then see where it takes you.</p><Link href="/create">Make a journey →</Link></div></div>}</section>
  </main>;
}
