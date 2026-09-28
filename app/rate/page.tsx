import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/utils/supabase/profile";
import { needsNames } from "@/utils/profile";
import { AccountNav } from "../components/account-nav";

export default async function RatePage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/");
  if (needsNames(current.profile)) redirect("/profile");
  return <main>
    <AccountNav />
    <section>
      <p className="eyebrow">Members only</p>
      <h1>Caption Rating</h1>
      <p>Rating interface coming next.</p>
    </section>
  </main>;
}
