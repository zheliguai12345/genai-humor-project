"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { unsplashUrl } from "@/utils/journeys/presentation";
import type { PhotoCandidate } from "@/utils/journeys/types";

export function PhotoCredit({ photo, overlay = false, id }: { photo: PhotoCandidate; overlay?: boolean; id?: string }) {
  return <figcaption id={id} className={`photo-credit${overlay ? " photo-credit-overlay" : ""}`}>{!overlay && "Photo by "}<a href={unsplashUrl(photo.photographer_username)} target="_blank" rel="noreferrer">{photo.photographer_name}</a>{overlay ? " / " : " on "}<a href={unsplashUrl()} target="_blank" rel="noreferrer">Unsplash</a></figcaption>;
}
function imageAllowed(url: string) {
  try { return new URL(url).origin === "https://images.unsplash.com"; } catch { return false; }
}
export function Photo({ photo, alt, priority = false, creditMode = "inline", href }: { photo: PhotoCandidate | null; alt: string; priority?: boolean; creditMode?: "inline" | "overlay"; href?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const creditId = useId();
  const overlay = creditMode === "overlay";
  const content = photo && failedUrl !== photo.url && imageAllowed(photo.url) ?
      // Direct Unsplash hotlink: preserve the exact returned URL and its tracking parameters.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo.url} alt={alt} width={640} height={480} loading={priority ? "eager" : "lazy"} decoding="async" onError={() => setFailedUrl(photo.url)} />
      : <div className="photo-placeholder" role="img" aria-label="No photograph available"><span aria-hidden="true">E.</span><span>A scene to imagine</span></div>;
  return <figure className={`photo${overlay ? " photo-overlay" : ""}${creditOpen ? " credit-open" : ""}`}>
    {href ? <Link className="photo-image-link" href={href} aria-label={alt}>{content}</Link> : content}
    {photo && overlay && <button type="button" className="photo-info" aria-label="Photo attribution" aria-expanded={creditOpen} aria-controls={creditId} onClick={() => setCreditOpen(open => !open)}><span aria-hidden="true">ⓘ</span></button>}
    {photo && <PhotoCredit photo={photo} id={creditId} overlay={overlay} />}
  </figure>;
}
