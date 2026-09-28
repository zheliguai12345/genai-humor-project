import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/utils/supabase/profile";
import { needsNames } from "@/utils/profile";
import { AccountNav } from "../components/account-nav";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/");
  return <main>
    <AccountNav />
    <h1>Profile</h1>
    {needsNames(current.profile) && <p role="status" className="notice">Welcome! Please enter your first and last name to complete your profile.</p>}
    {current.avatarUrl && <div className="avatar">
      {/* Private Storage signed URLs change on every render. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current.avatarUrl} alt="Your profile photo" width={96} height={96} />
    </div>}
    <ProfileForm profile={current.profile} />
    <p><Link href="/rate">Continue to Caption Rating →</Link></p>
  </main>;
}
