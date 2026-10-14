import Link from "next/link";
import { Suspense } from "react";
import { getOptionalUser } from "@/utils/supabase/server";
import { signOut } from "@/app/actions";
import { SignInLink } from "./sign-in-link";
import { Navigation } from "./navigation";

export async function SiteHeader() {
  const user = await getOptionalUser();
  return <header className="site-header">
    <div className="header-inner">
      <div className="header-brand">
        <Link className="wordmark" href="/" aria-label="Elsewhere, NYC. Discover">Elsewhere<span className="wordmark-comma">,</span><span> NYC.</span></Link>
        <p className="brand-slogan">One city. A thousand ways to live it.</p>
      </div>
      <Navigation />
      {user ? <form action={signOut} className="header-account"><button className="text-button" type="submit">Sign out</button></form>
        : <div className="header-account"><Suspense fallback={<Link href="/signin">Sign in with Google</Link>}><SignInLink /></Suspense></div>}
    </div>
  </header>;
}
