"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TIMES, BUDGETS, VIBES, type GenerationInput, type GenerationProgress } from "@/utils/journeys/types";
import { THEMES } from "@/utils/journeys/themes";
import { requestGeneration } from "@/utils/journeys/generation-stream";
import { resetLabel, type GenerationQuota } from "@/utils/journeys/presentation";

const stages: Record<GenerationProgress["stage"], string> = {
  model: "Inventing your day…", validation: "Checking the route…", retry: "Refining the journey…", photos: "Finding photographs…", saving: "Saving your private draft…", provider_retry: "The city is busy. Trying again…", fallback: "Busy right now — trying a faster model…",
};
const labels: Record<string, string> = { history: "History", art: "Art", absurd: "Absurd", quiet: "Quiet", food: "Food", night: "Night", "luxury-on-a-budget": "Luxury on a budget", solo: "Solo" };
export function CreateForm({ initialQuota }: { initialQuota: GenerationQuota }) {
  const [time, setTime] = useState<GenerationInput["time"]>("afternoon");
  const [budget, setBudget] = useState<GenerationInput["budget"]>("under $25");
  const [vibes, setVibes] = useState<GenerationInput["vibes"]>([]);
  const [idea, setIdea] = useState("");
  const [quota, setQuota] = useState(initialQuota);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<GenerationProgress["stage"]>("model");
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const router = useRouter();
  useEffect(() => () => activeRequest.current?.abort(), []);
  function generate(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || quota.remaining === 0) return;
    locked.current = true; setError(""); setStage("model");
    const controller = new AbortController(); activeRequest.current = controller;
    startTransition(async () => {
      try {
        const result = await requestGeneration({ time, budget, vibes, wild_idea: idea }, event => setStage(event.stage), AbortSignal.any([controller.signal, AbortSignal.timeout(100_000)]));
        if (result.error) { setError(result.error); if (result.quota) setQuota(result.quota); }
        else if (result.data) router.push(`/preview/${result.data.journey_id}`);
      } catch { if (!controller.signal.aborted) setError("The connection was interrupted. Check Your journeys before trying again."); }
      finally { locked.current = false; activeRequest.current = null; }
    });
  }
  return <form onSubmit={generate} className="create-form" aria-busy={pending}>
    <div className="idea-label"><label htmlFor="wild-idea" className="sr-only">Your wild idea</label><span id="idea-count">{Array.from(idea).length} / 200</span></div>
    <textarea id="wild-idea" name="wild_idea" placeholder="A day in New York where…" rows={3} value={idea} disabled={pending} aria-describedby="idea-count" onChange={e => setIdea(Array.from(e.target.value).slice(0, 200).join(""))} />
    <div className="theme-tags" aria-label="Starting themes">{THEMES.map(theme => {
      const text = `${theme.title} — ${theme.line}`;
      return <button key={theme.title} type="button" aria-pressed={idea === text} disabled={pending} onClick={() => setIdea(text)}>{theme.title}</button>;
    })}</div>
    <details className="generation-options"><summary>Options</summary><div>
      <div className="preference-grid"><fieldset disabled={pending}><legend>Time</legend><div className="option-group">{TIMES.map(value => <label className="option" key={value}><input type="radio" name="time" value={value} checked={time === value} onChange={() => setTime(value)} /><span>{value === "full day" ? "Full day" : value === "afternoon" ? "Afternoon" : "Evening"}</span></label>)}</div></fieldset>
        <fieldset disabled={pending}><legend>Budget</legend><div className="option-group">{BUDGETS.map(value => <label className="option" key={value}><input type="radio" name="budget" value={value} checked={budget === value} onChange={() => setBudget(value)} /><span>{value === "flexible" ? "Flexible" : value.replace("under", "Under")}</span></label>)}</div></fieldset></div>
      <fieldset disabled={pending}><legend>Interests</legend><div className="option-group">{VIBES.map(value => <label className="option" key={value}><input type="checkbox" value={value} checked={vibes.includes(value)} onChange={() => setVibes(current => current.includes(value) ? current.filter(v => v !== value) : [...current, value])} /><span>{labels[value]}</span></label>)}</div></fieldset>
    </div></details>
    <button type="submit" className="button generate-button" disabled={pending || quota.remaining === 0}>{pending ? "Generating…" : "Generate"}<span aria-hidden="true">↗</span></button>
    <p className="quota-label">{quota.remaining} attempts left · Resets {resetLabel(quota.resets_at)} New York time</p>
    {pending && <p className="generation-status" role="status" aria-live="polite">{stages[stage]}</p>}
    {error && <p className="notice error-notice" role="alert">{error}</p>}
  </form>;
}
