import Link from "next/link";
import { Suspense } from "react";
import { getOptionalUser } from "@/utils/supabase/server";
import { signOut } from "@/app/actions";
import { GoogleSignIn } from "./google-sign-in";
import { Navigation } from "./navigation";

export async function SiteHeader() {
  const user = await getOptionalUser();
  return <header className="site-header">
    <div className="header-inner">
      <Link className="wordmark" href="/" aria-label="Elsewhere, NYC. Discover">Elsewhere<span>, NYC.</span></Link>
      <Navigation />
      {user ? <form action={signOut} className="header-account"><button className="text-button" type="submit">Sign out</button></form>
        : <div id="sign-in" className="header-account google-sign-in" tabIndex={-1}><Suspense fallback={<p>Loading Google sign-in…</p>}><GoogleSignIn /></Suspense></div>}
    </div>
  </header>;
}
