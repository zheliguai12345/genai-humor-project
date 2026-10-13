"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Journey } from "@/utils/journeys/types";
import { deleteJourney } from "@/app/journey-actions";
import { JourneyCard } from "../components/journey-card";

export function YourJourneys({ journeys }: { journeys: Omit<Journey, "stops">[] }) {
  const [items, setItems] = useState(journeys);
  const [source, setSource] = useState(journeys);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  const router = useRouter();
  if (source !== journeys && !pending) { setSource(journeys); setItems(journeys); }
  function remove(journey: Omit<Journey, "stops">) {
    if (locked.current || journey.is_editorial) return;
    const confirmation = "Delete this journey? This can't be undone." +
      (journey.status === "published" ? "\nIts votes will be removed too." : "");
    if (!window.confirm(confirmation)) return;
    locked.current = true; setMessage(""); setError("");
    startTransition(async () => {
      try {
        const result = await deleteJourney(journey.id);
        if (result.error) { setError(result.error); return; }
        setItems(current => current.filter(item => item.id !== journey.id));
        setMessage("Journey deleted"); router.refresh();
      } catch { setError("Journey not deleted. Please try again."); }
      finally { locked.current = false; }
    });
  }
  return <>
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="notice error-notice" role="alert">{error}</p>}
    <div className="journey-grid">{items.map(journey => <div key={journey.id} className="profile-journey">
      <JourneyCard journey={journey} privateView />
      {!journey.is_editorial && <button type="button" className="profile-delete-button" disabled={pending} aria-label={`Delete ${journey.title}`} onClick={() => remove(journey)}>Delete</button>}
    </div>)}</div>
    {!items.length && <p className="empty-state">Your first journey starts in Create.</p>}
    {items.length === 100 && <p className="hint">Showing your latest 100 journeys.</p>}
  </>;
}
