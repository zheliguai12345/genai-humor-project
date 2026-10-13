"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { vote } from "@/app/journey-actions";
import type { VoteCounts } from "@/utils/journeys/presentation";

export function VoteControls({ journeyId, authenticated, currentVote, counts }: {
  journeyId: string; authenticated: boolean; currentVote: "up" | "down" | null; counts: VoteCounts;
}) {
  const [selected, setSelected] = useState(currentVote);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  const router = useRouter();
  function choose(value: "up" | "down") {
    if (!authenticated) {
      setMessage("Sign in with Google above to add your vote. Your opinion is welcome here.");
      document.getElementById("sign-in")?.focus();
      document.getElementById("sign-in")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (locked.current) return;
    locked.current = true;
    startTransition(async () => {
      try {
        const result = await vote(journeyId, value);
        if (result.error) setMessage(result.error);
        else { setSelected(value); setMessage("Your vote is saved. You can change it whenever you like."); router.refresh(); }
      } catch { setMessage("We couldn't save your vote. Please try again."); }
      finally { locked.current = false; }
    });
  }
  return <section id="vote" className="vote-panel" aria-labelledby="vote-title"><p className="section-label">The real-world test</p><h2 id="vote-title">Would you actually spend a day like this?</h2>
    <div className="vote-controls"><button type="button" className={selected === "up" ? "vote-option selected" : "vote-option"} aria-pressed={selected === "up"} disabled={pending} onClick={() => choose("up")}><span>I&apos;d do this</span><span>{counts.up}</span></button>
      <button type="button" className={selected === "down" ? "vote-option selected" : "vote-option"} aria-pressed={selected === "down"} disabled={pending} onClick={() => choose("down")}><span>Not my vibe</span><span>{counts.down}</span></button></div>
    <p className="hint">{authenticated ? "One vote per journey. A change of heart is allowed." : "You can read every journey without an account. Sign in to vote."}</p>
    <p role="status" aria-live="polite" className="action-status">{pending ? "Saving your vote…" : message}</p>
  </section>;
}
