import Link from "next/link";
export default function NotFound() {
  return <main id="main-content" className="simple-page"><p className="section-label">A wrong turn</p><h1>This journey isn&apos;t here.</h1><p>It may still be a private draft, or this address may have changed.</p><Link className="button" href="/">Return to Discover →</Link></main>;
}
