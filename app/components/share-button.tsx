"use client";
import { useEffect, useRef, useState } from "react";
import type { Journey } from "@/utils/journeys/types";

export function ShareButton({ journey, iconOnly = false }: {
  journey: Pick<Journey, "id" | "title" | "hook" | "status">; iconOnly?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (journey.status !== "published") return null;
  async function share(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault(); event.stopPropagation();
    if (locked.current) return;
    locked.current = true; setPending(true); setMessage(""); setFailed(false);
    if (timer.current) clearTimeout(timer.current);
    const url = new URL(`/journeys/${journey.id}`, window.location.origin).href;
    try {
      if (typeof navigator.share === "function") await navigator.share({ title: journey.title, text: journey.hook, url });
      else {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(url);
        setMessage("Link copied"); timer.current = setTimeout(() => setMessage(""), 2000);
      }
    } catch (error) {
      if (!(error && typeof error === "object" && "name" in error && error.name === "AbortError")) {
        setFailed(true); setMessage("Couldn't share the link. Please try again.");
      }
    } finally { locked.current = false; setPending(false); }
  }
  return <span className="share-widget"><button type="button" className={`share-button${iconOnly ? " share-icon" : ""}`} aria-label={iconOnly ? "Share this journey" : "Share"} title="Share this journey" disabled={pending} onClick={share}>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3m-4 4 4-4 4 4M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" /></svg>
    {!iconOnly && "Share"}</button>{message && <span className="share-message" role={failed ? "alert" : "status"}>{message}</span>}</span>;
}
