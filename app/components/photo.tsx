"use client";
import { useState } from "react";
import { unsplashUrl } from "@/utils/journeys/presentation";
import type { PhotoCandidate } from "@/utils/journeys/types";

export function PhotoCredit({ photo }: { photo: PhotoCandidate }) {
  return <figcaption className="photo-credit">Photo by <a href={unsplashUrl(photo.photographer_username)} target="_blank" rel="noreferrer">{photo.photographer_name}</a> on <a href={unsplashUrl()} target="_blank" rel="noreferrer">Unsplash</a></figcaption>;
}
function imageAllowed(url: string) {
  try { return new URL(url).origin === "https://images.unsplash.com"; } catch { return false; }
}
export function Photo({ photo, alt, priority = false }: { photo: PhotoCandidate | null; alt: string; priority?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <figure className="photo">
    {photo && failedUrl !== photo.url && imageAllowed(photo.url) ?
      // Direct Unsplash hotlink: preserve the exact returned URL and its tracking parameters.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo.url} alt={alt} width={640} height={480} loading={priority ? "eager" : "lazy"} decoding="async" onError={() => setFailedUrl(photo.url)} />
      : <div className="photo-placeholder" role="img" aria-label="No photograph available"><span aria-hidden="true">E.</span><span>A scene to imagine</span></div>}
    {photo && <PhotoCredit photo={photo} />}
  </figure>;
}
