"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { vote } from "@/app/journey-actions";
import { optimisticVote, type VoteCounts, type VoteState } from "@/utils/journeys/presentation";

export function VoteControls({ journeyId, authenticated, currentVote, counts }: {
  journeyId: string; authenticated: boolean; currentVote: "up" | "down" | null; counts: VoteCounts;
}) {
  const incoming = `${currentVote}:${counts.up}:${counts.down}`;
  const [source, setSource] = useState(incoming);
  const [state, setState] = useState<VoteState>({ selected: currentVote, counts });
  const [message, setMessage] = useState("");
  const [signin, setSignin] = useState(false);
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  const router = useRouter();
  if (source !== incoming && !pending) {
    setSource(incoming); setState({ selected: currentVote, counts });
  }
  function choose(direction: "up" | "down") {
    if (!authenticated) { setSignin(true); return; }
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
  function focusLogin() {
    const target = document.getElementById("sign-in");
    target?.focus(); target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return <div className="vote-widget" aria-label="Journey voting">
    <div className="vote-controls"><button type="button" className="vote-arrow" aria-label={state.selected === "up" ? "Cancel upvote" : "Upvote"} title="I'd do this" aria-pressed={state.selected === "up"} disabled={pending} onClick={() => choose("up")}><span aria-hidden="true">▲</span></button>
      <span className="vote-score" aria-label="Journey score" aria-live="polite">{state.counts.up - state.counts.down}</span>
      <button type="button" className="vote-arrow" aria-label={state.selected === "down" ? "Cancel downvote" : "Downvote"} title="Not my vibe" aria-pressed={state.selected === "down"} disabled={pending} onClick={() => choose("down")}><span aria-hidden="true">▼</span></button></div>
    {signin && <div className="vote-signin" role="status"><span>Sign in to vote.</span><button type="button" onClick={focusLogin}>Google sign-in ↑</button><button className="dismiss-button" type="button" aria-label="Dismiss sign-in message" onClick={() => setSignin(false)}>×</button></div>}
    {message && <p className="vote-error" role="alert">{message}</p>}
  </div>;
}
