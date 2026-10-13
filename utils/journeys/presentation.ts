import type { Journey } from "./types";

export type VoteCounts = { up: number; down: number };
export type JourneySummary = Omit<Journey, "stops"> & { stop_count?: number };
export type GenerationQuota = { used: number; remaining: number; resets_at: string };

export function mapsUrl(place: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place}, New York, NY`)}`;
}
export function unsplashUrl(username?: string) {
  return `https://unsplash.com${username ? `/@${encodeURIComponent(username)}` : ""}?utm_source=elsewhere_nyc&utm_medium=referral`;
}
export function quotaWindow(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return { starts_at: start.toISOString(), resets_at: new Date(start.getTime() + 86_400_000).toISOString() };
}
export function resetLabel(resetsAt: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(resetsAt));
}
export function durationLabel(journey: Pick<Journey, "when_label" | "mode">) {
  // Derive only from the supplied time window, never from assumed travel speeds.
  const range = journey.when_label.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–—-]\s*(?:(\d{1,2})(?::(\d{2}))?\s*(AM|PM)|midnight)/i);
  if (!range) return journey.when_label;
  const endPeriod = range[6]?.toUpperCase();
  const startPeriod = range[3]?.toUpperCase() ?? endPeriod;
  const minutes = (hour: number, minute: number, period?: string) => (period ? hour % 12 + (period === "PM" ? 12 : 0) : hour) * 60 + minute;
  const start = minutes(Number(range[1]), Number(range[2] ?? 0), startPeriod);
  let end = range[4] ? minutes(Number(range[4]), Number(range[5] ?? 0), endPeriod) : 1440;
  if (end <= start) end += 1440;
  const total = end - start;
  if (total > 24 * 60) return journey.when_label;
  const hours = Math.floor(total / 60), remainder = total % 60;
  return `${hours ? `${hours} hr` : ""}${hours && remainder ? " " : ""}${remainder ? `${remainder} min` : ""}`;
}

export function stopCount(journey: Pick<Journey, "mode"> & { stop_count?: number; stops?: unknown[] }) {
  return journey.stops?.length ?? journey.stop_count ?? Number(journey.mode.match(/(\d+) stops?/)?.[1] ?? 0);
}
export type VoteState = { selected: "up" | "down" | null; counts: VoteCounts };
export function optimisticVote(state: VoteState, direction: "up" | "down"): VoteState {
  const selected = state.selected === direction ? null : direction;
  const counts = { ...state.counts };
  if (state.selected) counts[state.selected]--;
  if (selected) counts[selected]++;
  return { selected, counts };
}
