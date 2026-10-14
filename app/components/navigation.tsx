"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function Navigation() {
  const path = usePathname();
  return <nav className="site-nav" aria-label="Main navigation">{[
    { href: "/#discover", label: "Discover", active: path === "/" || path === "/discover" || path.startsWith("/journeys/") },
    { href: "/create", label: "Create", active: path === "/create" || path.startsWith("/preview/") },
    { href: "/profile", label: "Profile", active: path === "/profile" },
  ].map(link => <Link href={link.href} key={link.href} aria-current={link.active ? "page" : undefined}>{link.label}</Link>)}</nav>;
}
