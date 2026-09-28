"use client";

import { useActionState } from "react";
import { submitVote } from "./actions";

export function VoteForm({ captionId }: { captionId: string }) {
  const [state, action, pending] = useActionState(submitVote, {});
  return <form action={action}>
    <input type="hidden" name="caption_id" value={captionId} />
    <div className="vote-controls">
      <button type="submit" name="vote" value="up" className={state.saved === "up" ? undefined : "secondary"} disabled={pending}>👍 Upvote</button>
      <button type="submit" name="vote" value="down" className={state.saved === "down" ? undefined : "secondary"} disabled={pending}>👎 Downvote</button>
    </div>
    <p role="status" aria-live="polite">
      {pending ? "Saving…" : state.saved ? `${state.saved === "up" ? "Upvote" : "Downvote"} saved. Thank you!` : ""}
    </p>
    {state.error && <p role="alert">{state.error}</p>}
  </form>;
}
