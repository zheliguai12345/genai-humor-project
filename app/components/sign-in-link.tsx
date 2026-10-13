"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { safeReturnPath } from "@/utils/auth-return";

export function SignInLink() {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const next = safeReturnPath(pathname === "/signin" ? search.get("next") : `${pathname}${query ? `?${query}` : ""}`);
  return <Link className="button secondary" href={`/signin?next=${encodeURIComponent(next)}`}>Sign in with Google</Link>;
}
