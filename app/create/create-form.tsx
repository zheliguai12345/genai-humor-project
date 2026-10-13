"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createJourney } from "@/app/journey-actions";
import { TIMES, BUDGETS, VIBES, type GenerationInput } from "@/utils/journeys/types";
import { THEMES } from "@/utils/journeys/themes";
import { resetLabel, type GenerationQuota } from "@/utils/journeys/presentation";

const stages = ["Inventing a premise…", "Walking the route…", "Finding photographs…"];
const vibeLabels: Record<string,string> = { history:"History",art:"Art",absurd:"Absurd",quiet:"Quiet",food:"Food",night:"Night","luxury-on-a-budget":"Luxury on a budget",solo:"Solo" };
export function CreateForm({ initialQuota }: { initialQuota: GenerationQuota }) {
  const [time, setTime] = useState<GenerationInput["time"]>("afternoon");
  const [budget, setBudget] = useState<GenerationInput["budget"]>("under $25");
  const [vibes, setVibes] = useState<GenerationInput["vibes"]>([]);
  const [idea, setIdea] = useState("");
  const [quota, setQuota] = useState(initialQuota);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(0);
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setStage(s => Math.min(s + 1, stages.length - 1)), 9_000);
    return () => clearInterval(timer);
  }, [pending]);
  function generate(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || quota.remaining === 0) return;
    locked.current = true; setError(""); setStage(0);
    startTransition(async () => {
      try {
        const result = await createJourney({ time, budget, vibes, wild_idea: idea });
        if (result.error) { setError(result.error); if (result.quota) setQuota(result.quota); }
        else if (result.data) router.push(`/preview/${result.data.journey_id}`);
      } catch { setError("Your journey didn't finish. Please try again in a moment."); }
      finally { locked.current = false; }
    });
  }
  return <form onSubmit={generate} className="create-form" aria-busy={pending}>
    <fieldset className="theme-fieldset" disabled={pending}><legend>Start from a theme</legend><p className="hint">Borrow a premise. Change anything. Or write your own below.</p>
      <div className="theme-grid">{THEMES.map((theme,index) => {
        const value = `${theme.title} — ${theme.line}`;
        return <button type="button" key={theme.title} className={idea === value ? "theme-card selected" : "theme-card"} aria-pressed={idea === value} onClick={() => setIdea(value)}><span className="theme-number">{String(index+1).padStart(2,"0")}</span><span className="theme-title">{theme.title}</span><span className="theme-description">{theme.line}</span><span className="theme-check" aria-hidden="true">{idea === value ? "✓" : "↗"}</span></button>;
      })}</div>
    </fieldset>
    <div className="form-section"><div className="section-heading"><h2>Give the day some shape.</h2><span>The city will do the rest.</span></div>
      <div className="preference-grid"><fieldset disabled={pending}><legend>How much time?</legend><div className="option-group">{TIMES.map(value=><label className="option" key={value}><input type="radio" name="time" value={value} checked={time===value} onChange={()=>setTime(value)} /><span>{value === "full day" ? "A full day" : value === "afternoon" ? "An afternoon" : "An evening"}</span></label>)}</div></fieldset>
        <fieldset disabled={pending}><legend>Your budget</legend><div className="option-group">{BUDGETS.map(value=><label className="option" key={value}><input type="radio" name="budget" value={value} checked={budget===value} onChange={()=>setBudget(value)} /><span>{value === "flexible" ? "Keep it flexible" : value.replace("under","Under")}</span></label>)}</div></fieldset></div>
      <fieldset disabled={pending}><legend>What are you drawn to?</legend><div className="vibe-options">{VIBES.map(value=><label className="option" key={value}><input type="checkbox" value={value} checked={vibes.includes(value)} onChange={()=>setVibes(current=>current.includes(value)?current.filter(v=>v!==value):[...current,value])} /><span>{vibeLabels[value]}</span></label>)}</div><p className="hint">Choose as many as you like. Leaving this open is fine, too.</p></fieldset>
      <div className="idea-label"><label htmlFor="wild-idea">What&apos;s your wild idea? <span>Optional</span></label><span id="idea-count" aria-live="polite">{Array.from(idea).length} / 200</span></div>
      <textarea id="wild-idea" name="wild_idea" rows={3} value={idea} disabled={pending} aria-describedby="idea-count idea-help" placeholder="What if the city was auditioning to be your best friend?" onChange={e=>setIdea(Array.from(e.target.value).slice(0,200).join(""))} />
      <p id="idea-help" className="hint">A sentence is plenty. Think of a premise, not a list of places.</p>
    </div>
    <div className="generate-footer"><div><p className="quota-label">{quota.remaining} of 10 generation attempts remaining</p><p className="hint">Resets {resetLabel(quota.resets_at)} New York time. A validation retry also uses an attempt.</p></div><button type="submit" className="button" disabled={pending || quota.remaining===0}>{pending ? "Your day is taking shape…" : "Generate my journey"}<span aria-hidden="true">↗</span></button></div>
    {quota.remaining===0 && <p className="notice" role="status">You&apos;ve used today&apos;s allowance. 0 attempts remain. Come back after {resetLabel(quota.resets_at)} New York time.</p>}
    {pending && <div className="generation-progress" role="status" aria-live="polite"><strong>{stages[stage]}</strong><p>Your result stays private until you preview and publish it.</p><div className="progress-segments" aria-hidden="true">{stages.map((s,i)=><span key={s} className={i<=stage?"active":""} />)}</div></div>}
    {error && <p className="notice error-notice" role="alert">{error}</p>}
  </form>;
}
