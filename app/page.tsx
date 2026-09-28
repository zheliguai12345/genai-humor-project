import Link from "next/link";
import { getCurrentProfile } from "@/utils/supabase/profile";
import { needsNames } from "@/utils/profile";
import { GoogleSignIn } from "./components/google-sign-in";
import { AccountNav } from "./components/account-nav";

export default async function Home({ searchParams }: PageProps<"/">) {
  const current = await getCurrentProfile();
  const { error } = await searchParams;
  return <main>
    <p className="eyebrow">The Humor Project</p>
    <h1>A little humor. A fresh perspective.</h1>
    <p>A home for captions worth a second look.</p>
    {current ? <>
      <AccountNav />
      <section>
        <h2>{current.profile.first_name ? `Welcome, ${current.profile.first_name}.` : "You're signed in."}</h2>
        {needsNames(current.profile)
          ? <p>Please <Link href="/profile">complete your first and last name</Link> to get started.</p>
          : <p>Your account is ready. <Link href="/rate">Go to Caption Rating</Link>.</p>}
      </section>
    </> : <section>
      <h2>Join the conversation</h2>
      <p>Sign in to manage your profile and enter Caption Rating.</p>
      {error && <p role="alert">Google sign-in did not finish. Please try again.</p>}
      <GoogleSignIn />
    </section>}
    <p className="hint"><Link href="/privacy">Privacy</Link></p>
  </main>;
}
