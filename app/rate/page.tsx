import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/utils/supabase/profile";
import { needsNames } from "@/utils/profile";
import { AccountNav } from "../components/account-nav";
import { getRatingCaptions } from "@/utils/supabase/rating";
import { VoteForm } from "./vote-form";

export default async function RatePage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/");
  if (needsNames(current.profile)) redirect("/profile");
  const captions = await getRatingCaptions();
  return <main>
    <AccountNav />
    <p className="eyebrow">Members only</p>
    <h1>Caption Rating</h1>
    <p>Which captions make you laugh?</p>
    {captions.length === 0 && <p>No captions are available yet. Please check back later.</p>}
    {captions.map((caption) => <section key={caption.id} aria-label="Caption">
      <p>{caption.text}</p>
      <VoteForm captionId={caption.id} />
    </section>)}
  </main>;
}
