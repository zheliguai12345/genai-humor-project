import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { GoogleSignIn } from "@/app/components/google-sign-in";
import { getOptionalUser } from "@/utils/supabase/server";
import { safeReturnPath } from "@/utils/auth-return";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const nextPath = safeReturnPath(params.next);
  if (await getOptionalUser()) redirect(nextPath);
  return <main id="main-content" className="signin-page"><section className="signin-panel" aria-labelledby="signin-heading">
    <h1 id="signin-heading">Sign in to vote and make journeys.</h1>
    {params.error && <p role="alert" className="notice error-notice">Sign-in didn&apos;t finish. Please try again.</p>}
    <div className="signin-google"><Suspense fallback={<p>Loading Google sign-in…</p>}><GoogleSignIn nextPath={nextPath} /></Suspense></div>
  </section></main>;
}
