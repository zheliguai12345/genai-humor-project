import Link from "next/link";
import { signOut } from "@/app/actions";

export function AccountNav() {
  return <nav aria-label="Account">
    <Link href="/">Home</Link>
    <Link href="/profile">Profile</Link>
    <Link href="/rate">Caption Rating</Link>
    <form action={signOut}><button type="submit" className="secondary">Sign out</button></form>
  </nav>;
}
