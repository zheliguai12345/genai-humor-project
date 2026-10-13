"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { vote } from "@/app/journey-actions";
import { optimisticVote, type VoteCounts, type VoteState } from "@/utils/journeys/presentation";
import { safeReturnPath } from "@/utils/auth-return";

export function VoteControls({ journeyId, authenticated, currentVote, counts }: {
  journeyId: string; authenticated: boolean; currentVote: "up" | "down" | null; counts: VoteCounts;
}) {
  const incoming = `${currentVote}:${counts.up}:${counts.down}`;
  const [source, setSource] = useState(incoming);
  const [state, setState] = useState<VoteState>({ selected: currentVote, counts });
  const [message, setMessage] = useState("");
  const [signin, setSignin] = useState(false);
  const pathname = usePathname();
  const [returnTo, setReturnTo] = useState(pathname);
  const popupId = useId();
  const popup = useRef<HTMLDivElement>(null);
  const signinLink = useRef<HTMLAnchorElement>(null);
  const originButton = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  const router = useRouter();
  useEffect(() => {
    const opened = (event: Event) => { if ((event as CustomEvent<string>).detail !== popupId) setSignin(false); };
    document.addEventListener("elsewhere:vote-signin", opened);
    return () => document.removeEventListener("elsewhere:vote-signin", opened);
  }, [popupId]);
  useEffect(() => {
    if (!signin) return;
    signinLink.current?.focus();
    const close = () => { setSignin(false); originButton.current?.focus(); };
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!popup.current?.contains(target) && !originButton.current?.contains(target)) close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    document.addEventListener("click", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", outside); document.removeEventListener("keydown", escape); };
  }, [signin]);
  if (source !== incoming && !pending) {
    setSource(incoming); setState({ selected: currentVote, counts });
  }
  function choose(direction: "up" | "down", event: React.MouseEvent<HTMLButtonElement>) {
    if (!authenticated) {
      originButton.current = event.currentTarget;
      setReturnTo(safeReturnPath(typeof window === "undefined" ? pathname : `${window.location.pathname}${window.location.search}${window.location.hash}`));
      if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("elsewhere:vote-signin", { detail: popupId }));
      setSignin(true); signinLink.current?.focus(); return;
    }
    if (locked.current) return;
    locked.current = true; setMessage("");
    const before = state;
    const after = optimisticVote(before, direction);
    setState(after);
    startTransition(async () => {
      try {
        const result = await vote(journeyId, after.selected);
        if (result.error) { setState(before); setMessage(result.error); }
        else router.refresh();
      } catch { setState(before); setMessage("Vote not saved. Please try again."); }
      finally { locked.current = false; }
    });
  }
  return <div className="vote-widget" aria-label="Journey voting">
    <div className="vote-controls"><button type="button" className="vote-arrow" aria-label={state.selected === "up" ? "Cancel upvote" : "Upvote"} title="I'd do this" aria-pressed={state.selected === "up"} disabled={pending} onClick={event => choose("up", event)}><span aria-hidden="true">▲</span></button>
      <span className="vote-score" aria-label="Journey score" aria-live="polite">{state.counts.up - state.counts.down}</span>
      <button type="button" className="vote-arrow" aria-label={state.selected === "down" ? "Cancel downvote" : "Downvote"} title="Not my vibe" aria-pressed={state.selected === "down"} disabled={pending} onClick={event => choose("down", event)}><span aria-hidden="true">▼</span></button></div>
    {signin && <div ref={popup} className="vote-signin" role="dialog" aria-label="Sign in to vote"><span>Sign in to vote.</span><Link ref={signinLink} href={`/signin?next=${encodeURIComponent(returnTo)}`}>Sign in with Google</Link><button className="dismiss-button" type="button" aria-label="Dismiss sign-in message" onClick={() => { setSignin(false); originButton.current?.focus(); }}>×</button></div>}
    {message && <p className="vote-error" role="alert">{message}</p>}
  </div>;
}
