"use client";
import { useEffect, useRef, useState } from "react";
import type { Journey } from "@/utils/journeys/types";

let activeShare: { dismiss: () => void } | null = null;

export function ShareButton({ journey, iconOnly = false }: {
  journey: Pick<Journey, "id" | "title" | "hook" | "status">; iconOnly?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const owner = useRef<{ dismiss: () => void } | null>(null);
  const mounted = useRef(false);
  const dismissRef = useRef<() => void>(() => {});
  useEffect(() => {
    mounted.current = true;
    function dismiss() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (activeShare === owner.current) activeShare = null;
      owner.current = null;
      if (mounted.current) setMessage("");
    }
    function outside(event: PointerEvent) {
      if (!button.current?.contains(event.target as Node)) dismiss();
    }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") dismiss(); }
    const doc = window.document;
    doc.addEventListener("pointerdown", outside, true);
    doc.addEventListener("keydown", escape);
    doc.addEventListener("scroll", dismiss, true);
    dismissRef.current = dismiss;
    return () => {
      mounted.current = false;
      dismiss();
      doc.removeEventListener("pointerdown", outside, true);
      doc.removeEventListener("keydown", escape);
      doc.removeEventListener("scroll", dismiss, true);
    };
  }, []);
  if (journey.status !== "published") return null;
  async function share(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault(); event.stopPropagation();
    if (locked.current) return;
    activeShare?.dismiss();
    const current = { dismiss: () => dismissRef.current() };
    owner.current = current;
    activeShare = current;
    locked.current = true; setPending(true); setMessage(""); setFailed(false);
    if (timer.current) clearTimeout(timer.current);
    const url = new URL(`/journeys/${journey.id}`, window.location.origin).href;
    try {
      const desktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (!desktop && typeof navigator.share === "function") await navigator.share({ title: journey.title, text: journey.hook, url });
      else {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(url);
        if (mounted.current && activeShare === current) {
          setMessage("Link copied"); timer.current = setTimeout(current.dismiss, 2000);
        }
      }
    } catch (error) {
      if (mounted.current && activeShare === current && !(error && typeof error === "object" && "name" in error && error.name === "AbortError")) {
        setFailed(true); setMessage("Couldn't share the link. Please try again.");
      }
    } finally { locked.current = false; if (mounted.current) setPending(false); }
  }
  return <span className="share-widget"><button ref={button} type="button" className={`share-button${iconOnly ? " share-icon" : ""}`} aria-label={iconOnly ? "Share this journey" : "Share"} title="Share this journey" disabled={pending} onClick={share}>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3m-4 4 4-4 4 4M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" /></svg>
    {!iconOnly && "Share"}</button>{message && <span className="share-message" role={failed ? "alert" : "status"}>{message}</span>}</span>;
}
