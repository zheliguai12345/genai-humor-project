"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main id="main-content" className="simple-page"><p className="section-label">A brief detour</p><h1>The city can wait a moment.</h1><p>We couldn&apos;t load this page. Please try again in a moment.</p><button className="button" type="button" onClick={reset}>Try again →</button></main>;
}
