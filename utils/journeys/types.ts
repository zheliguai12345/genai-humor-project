export const TIMES = ["afternoon", "evening", "full day"] as const;
export const BUDGETS = ["under $25", "under $50", "flexible"] as const;
export const VIBES = ["history", "art", "absurd", "quiet", "food", "night", "luxury-on-a-budget", "solo"] as const;

export type GenerationInput = {
  time: typeof TIMES[number];
  budget: typeof BUDGETS[number];
  vibes: typeof VIBES[number][];
  wild_idea: string;
};
export type PhotoCandidate = {
  url: string;
  photographer_name: string;
  photographer_username: string;
  download_location: string | null;
};
export type JourneyImage = PhotoCandidate & { candidates: PhotoCandidate[] };
export type GeneratedStop = {
  time_label: string; title: string; place: string; body: string; move: string; image_query: string;
};
export type GeneratedJourney = {
  title: string; kicker: string; hook: string; premise: string;
  when_label: string; budget_label: string; area: string; mode: string; ending: string;
  cover_image_query: string; stops: GeneratedStop[];
};
export type JourneyStop = Omit<GeneratedStop, "image_query"> & {
  journey_id: string; position: number; image: JourneyImage | null;
};
export type Journey = Omit<GeneratedJourney, "cover_image_query" | "stops"> & {
  id: string; author_id: string | null; is_editorial: boolean;
  status: "draft" | "published"; published_at: string | null;
  cover_image: JourneyImage | null; generation_run_id: string | null;
  created_at: string; stops: JourneyStop[];
};
export type GenerationRun = {
  id: string; user_id: string; input: GenerationInput; system_prompt: string;
  user_prompt: string; model: string; raw_output: string | null;
  status: "success" | "failed"; error: string | null; journey_id: string | null; created_at: string;
};
export type ImageSelection = { position: number; candidate_index: number | null };
