import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";
import { configuredModel, generateJourneyText } from "../ai/gemini";
import { generationTelemetry } from "../ai/generation-telemetry";
import { SYSTEM_PROMPT, generationPrompt } from "../ai/journey-prompt";
import { searchJourneyImages, trackPublishedPhoto } from "../ai/unsplash";
import { JourneyAccessError, JourneyAuthError, JourneyInputError, JourneyOutputError, JourneyServiceError,
  validateId, validateInput, validateOutput, validateSelections } from "../journeys/validation";
import type { GenerationRun, Journey, JourneyStop, GenerationProgress } from "../journeys/types";
import { quotaWindow, resetLabel, type GenerationQuota, type JourneySummary, type VoteCounts } from "../journeys/presentation";

// Never export a general privileged client. Public reads have a fixed published filter;
// all private/mutation entry points independently validate ordinary Auth first.
function journeyClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new JourneyServiceError("Journey storage is not configured.");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
async function requireUser() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) throw new JourneyAuthError("Sign in to continue.");
  return user;
}
const JOURNEY_FIELDS = "id,author_id,is_editorial,status,published_at,title,kicker,hook,premise,when_label,budget_label,area,mode,ending,cover_image,generation_run_id,created_at";
const STOP_FIELDS = "journey_id,position,time_label,title,place,body,move,image";
async function stops(client: ReturnType<typeof journeyClient>, journeyId: string): Promise<JourneyStop[]> {
  const { data, error } = await client.from("journey_stops").select(STOP_FIELDS).eq("journey_id", journeyId).order("position");
  if (error) throw new JourneyServiceError("Unable to load journey stops.");
  return data;
}
export async function getPublishedJourneys() {
  const { data, error } = await journeyClient().from("journeys").select(JOURNEY_FIELDS)
    .eq("status", "published").order("published_at", { ascending: false }).limit(50);
  if (error) throw new JourneyServiceError("Unable to load published journeys.");
  return data as Omit<Journey, "stops">[];
}
export async function getPublishedJourney(id: string): Promise<Journey | null> {
  validateId(id);
  const client = journeyClient();
  const { data, error } = await client.from("journeys").select(JOURNEY_FIELDS).eq("id", id).eq("status", "published").maybeSingle();
  if (error) throw new JourneyServiceError("Unable to load this journey.");
  if (!data) return null;
  return { ...data, stops: await stops(client, id) } as Journey;
}
export async function getOwnDraft(id: string): Promise<Journey | null> {
  const user = await requireUser();
  validateId(id);
  const client = journeyClient();
  const { data, error } = await client.from("journeys").select(JOURNEY_FIELDS)
    .eq("id", id).eq("author_id", user.id).eq("status", "draft").maybeSingle();
  if (error) throw new JourneyServiceError("Unable to load this draft.");
  if (!data) return null;
  return { ...data, stops: await stops(client, id) } as Journey;
}
export async function getOwnGenerationRuns(): Promise<GenerationRun[]> {
  const user = await requireUser();
  const { data, error } = await journeyClient().from("generation_runs")
    .select("id,user_id,input,system_prompt,user_prompt,model,raw_output,status,error,journey_id,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
  if (error) throw new JourneyServiceError("Unable to load your generation history.");
  return data;
}
export async function deleteOwnJourney(id: string) {
  const user = await requireUser();
  validateId(id);
  const client = journeyClient();
  const current = await client.from("journeys").select("id,author_id,is_editorial").eq("id", id).maybeSingle();
  if (current.error) throw new JourneyServiceError("Unable to check this journey.");
  if (!current.data || current.data.author_id !== user.id || current.data.is_editorial) {
    throw new JourneyAccessError("You can only delete your own non-editorial journeys.");
  }
  const result = await client.from("journeys").delete().eq("id", id).eq("author_id", user.id).eq("is_editorial", false).select("id");
  if (result.error || result.data?.length !== 1) throw new JourneyServiceError("Journey not deleted. Please try again.");
  // Existing foreign keys cascade stops/votes and clear generation_runs.journey_id, preserving prompts/history.
  return { id };
}
export async function getOwnJourneyVote(id: string) {
  const user = await requireUser();
  validateId(id);
  const { data, error } = await journeyClient().from("journey_votes").select("value")
    .eq("journey_id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new JourneyServiceError("Unable to load your vote.");
  return data as { value: "up" | "down" } | null;
}

export async function getGenerationQuota(): Promise<GenerationQuota> {
  const user = await requireUser();
  const window = quotaWindow();
  const { count, error } = await journeyClient().from("generation_runs").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).gte("created_at", window.starts_at);
  if (error || count === null) throw new JourneyServiceError("Unable to load your generation allowance.");
  return { used: count, remaining: Math.max(0, 10 - count), resets_at: window.resets_at };
}

export async function getOwnJourneys(): Promise<JourneySummary[]> {
  const user = await requireUser();
  const { data, error } = await journeyClient().from("journeys").select(JOURNEY_FIELDS)
    .eq("author_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) throw new JourneyServiceError("Unable to load your journeys.");
  return data as JourneySummary[];
}

export async function getJourneyVoteCounts(id: string): Promise<VoteCounts> {
  validateId(id);
  const client = journeyClient();
  // Never expose even aggregate information about private drafts.
  const { data: published, error } = await client.from("journeys").select("id").eq("id", id).eq("status", "published").maybeSingle();
  if (error) throw new JourneyServiceError("Unable to load journey votes.");
  if (!published) return { up: 0, down: 0 };
  const results = await Promise.all(["up", "down"].map(value => client.from("journey_votes")
    .select("journey_id", { count: "exact", head: true }).eq("journey_id", id).eq("value", value)));
  if (results.some(r => r.error || r.count === null)) throw new JourneyServiceError("Unable to load journey votes.");
  return { up: results[0].count!, down: results[1].count! };
}

export async function getOwnJourneyVotes(ids: string[]): Promise<Record<string, "up" | "down">> {
  const user = await requireUser();
  if (!ids.length) return {};
  if (ids.length > 50) throw new JourneyInputError("Choose fewer journeys.");
  ids.forEach(validateId);
  const { data, error } = await journeyClient().from("journey_votes").select("journey_id,value")
    .eq("user_id", user.id).in("journey_id", ids);
  if (error) throw new JourneyServiceError("Unable to load your votes.");
  return Object.fromEntries(data.map(row => [row.journey_id, row.value]));
}

export async function getDiscoverJourneys(sort: "top" | "new" = "top") {
  const client = journeyClient();
  const counts: Record<string, VoteCounts> = {};
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("journey_votes")
      .select("journey_id,value,journeys!inner(status)").eq("journeys.status", "published")
      .order("journey_id").order("user_id").range(offset, offset + 499);
    if (error) throw new JourneyServiceError("Unable to load journey scores.");
    for (const row of data) {
      const count = counts[row.journey_id] ??= { up: 0, down: 0 };
      if (row.value === "up") count.up++; else if (row.value === "down") count.down++;
    }
    if (data.length < 500) break;
  }
  const published: JourneySummary[] = [];
  // Rank the complete published set, rather than only the most recent API page.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("journeys").select(`${JOURNEY_FIELDS},journey_stops(count)`)
      .eq("status", "published").order("published_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) throw new JourneyServiceError("Unable to load published journeys.");
    for (const { journey_stops, ...journey } of data) published.push({ ...journey, stop_count: journey_stops?.[0]?.count ?? 0 } as JourneySummary);
    if (data.length < 500) break;
  }
  const score = (id: string) => (counts[id]?.up ?? 0) - (counts[id]?.down ?? 0);
  published.sort((a, b) => (sort === "top" ? score(b.id) - score(a.id) : 0)
    || (b.published_at ?? "").localeCompare(a.published_at ?? "") || a.id.localeCompare(b.id));
  const filmstrip = [...published].filter(journey => journey.status === "published" && journey.cover_image?.url)
    .sort((a, b) => score(b.id) - score(a.id) || (b.published_at ?? "").localeCompare(a.published_at ?? "") || a.id.localeCompare(b.id))
    .slice(0, 12);
  return { journeys: published.slice(0, 50), counts, filmstrip };
}

export async function generateJourney(inputValue: unknown, progress?: (event: GenerationProgress) => void, requestSignal?: AbortSignal) {
  const user = await requireUser();
  const input = validateInput(inputValue);
  const model = configuredModel();
  const client = journeyClient();
  const signal = AbortSignal.any([AbortSignal.timeout(90_000), ...(requestSignal ? [requestSignal] : [])]);
  const telemetry = generationTelemetry();
  let correction: string | undefined;
  let actualModel = model;
  const validation_history: { user_prompt: string; raw_output: string | null; model: string; error: string }[] = [];
  const { data: runId, error: reserveError } = await client.rpc("reserve_journey_generation", {
    p_user_id: user.id, p_input: input, p_system_prompt: SYSTEM_PROMPT, p_user_prompt: generationPrompt(input), p_model: model,
  }).abortSignal(signal);
  if (reserveError || !runId) {
    if (reserveError?.message?.includes("daily_generation_limit")) throw new JourneyInputError(`You've reached today's 10-generation limit. 0 attempts remain. Resets ${resetLabel(quotaWindow().resets_at)} New York time.`);
    throw new JourneyServiceError("Unable to record this generation. Please try again.");
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted();
    const userPrompt = generationPrompt(input, correction);
    let raw: string | null = null;
    try {
      progress?.({ stage: "model", attempt: attempt + 1 });
      raw = await telemetry.measure("gemini", attempt + 1, () => generateJourneyText(SYSTEM_PROMPT, userPrompt, model, signal, {
        onModelUsed: used => { actualModel = used; },
        onProgress: stage => progress?.({ stage, attempt: attempt + 1 }),
        onTiming: timing => telemetry.record("gemini_request", attempt + 1, timing.duration_ms, timing),
      }));
      // Keep the exact model response even when parsing, image search, or draft persistence fails.
      const { error: rawError } = await client.from("generation_runs").update({ raw_output: raw, model: actualModel, user_prompt: userPrompt, input: validation_history.length ? { ...input, validation_history } : input })
        .eq("id", runId).eq("user_id", user.id).abortSignal(signal);
      if (rawError) throw new JourneyServiceError("Unable to record the generated response.");
      progress?.({ stage: "validation", attempt: attempt + 1 });
      const generated = await telemetry.measure("validation", attempt + 1, () => validateOutput(raw!));
      const queries = [generated.cover_image_query, ...generated.stops.map(s => s.image_query)];
      const uniqueQueries = [...new Set(queries)];
      progress?.({ stage: "photos", attempt: attempt + 1 });
      const images = new Map(await telemetry.measure("photos", attempt + 1, () => Promise.all(uniqueQueries.map(async (query, query_index) => [query, await searchJourneyImages(query, signal,
        timing => telemetry.record("unsplash", attempt + 1, timing.duration_ms, { ...timing, query_index }))] as const))));
      signal.throwIfAborted();
      const { cover_image_query, stops: generatedStops, ...copy } = generated;
      const journey = { ...copy, cover_image: images.get(cover_image_query) ?? null,
        stops: generatedStops.map(s => {
          const { image_query, ...stop } = s;
          return { ...stop, image: images.get(image_query) ?? null };
        }) };
      progress?.({ stage: "saving", attempt: attempt + 1 });
      const { data: journeyId, error: saveError } = await telemetry.measure("draft_save", attempt + 1, async () => await client.rpc("save_generated_journey", {
        p_user_id: user.id, p_run_id: runId, p_journey: journey,
      }).abortSignal(signal));
      if (saveError || !journeyId) throw new JourneyServiceError("We couldn't confirm the save. Check Your journeys before trying again.");
      telemetry.record("total", attempt + 1, telemetry.result().total_ms, { outcome: "success" });
      return { journey_id: journeyId, generation_run_id: runId, timing: telemetry.result() };
    } catch (error) {
      const validationFailure = error instanceof JourneyOutputError;
      const message = validationFailure ? error.message : signal.aborted
        ? "Generation timed out. Please try again." : error instanceof JourneyServiceError ? error.message : "We couldn't complete this journey. Please try again.";
      if (signal.aborted) { telemetry.record("total", attempt + 1, telemetry.result().total_ms, { outcome: "timeout" }); throw new JourneyServiceError("Generation timed out. Please try again."); }
      // A committed save can lose its network response. Never overwrite its successful audit row.
      // The reservation already records interruption if this bounded cleanup request also fails.
      const { error: logError } = await client.from("generation_runs").update({ status: "failed", raw_output: raw, error: message, model: actualModel, user_prompt: userPrompt, input: validation_history.length ? { ...input, validation_history } : input })
        .eq("id", runId).eq("user_id", user.id).eq("status", "failed")
        .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(5_000)]));
      if (logError) throw new JourneyServiceError(signal.aborted ? "Generation timed out. Please try again." : "Unable to record the generation result.");
      if (validationFailure && attempt === 0 && !signal.aborted) { validation_history.push({ user_prompt: userPrompt, raw_output: raw, model: actualModel, error: message }); telemetry.record("validation_retry", attempt + 1, 0, { outcome: "scheduled" }); progress?.({ stage: "retry", attempt: attempt + 2 }); correction = message; continue; }
      telemetry.record("total", attempt + 1, telemetry.result().total_ms, { outcome: "error" });
      throw new JourneyServiceError(validationFailure ? "The journey didn't come together. Please try a different idea." : message);
    }
  }
  throw new JourneyServiceError("The journey didn't come together. Please try again.");
}

export async function publishJourney(id: string, selectionValue: unknown) {
  const user = await requireUser();
  validateId(id);
  const client = journeyClient();
  const { data: draft, error: readError } = await client.from("journeys").select("id")
    .eq("id", id).eq("author_id", user.id).eq("status", "draft").maybeSingle();
  if (readError) throw new JourneyServiceError("Unable to load this draft.");
  if (!draft) throw new JourneyAccessError("This draft is not available.");
  const draftStops = await stops(client, id);
  const selections = validateSelections(selectionValue, [0, ...draftStops.map(s => s.position)]);
  const { data, error } = await client.rpc("publish_journey", {
    p_user_id: user.id, p_journey_id: id, p_selection: selections,
  });
  if (error) {
    if (error.message?.includes("draft_not_found")) throw new JourneyAccessError("This draft is not available.");
    throw new JourneyServiceError("Unable to publish this journey. Check your photo selections and try again.");
  }
  // The database has committed publication. Tracking failure must never change that result.
  const selected = data as { position: number; image: Journey["cover_image"] }[];
  await Promise.all(selected.map(async ({ position, image }) => {
    if (!image) return;
    try {
      if (!image.download_location) throw new Error("Missing download location");
      await trackPublishedPhoto(image.download_location);
    } catch {
      // Log only a fixed message and non-sensitive IDs, never URLs, provider errors, or keys.
      console.warn("Unsplash publication tracking failed", { journey_id: id, position });
    }
  }));
  return { journey_id: id };
}

export async function voteOnJourney(id: string, value: unknown) {
  const user = await requireUser();
  validateId(id);
  if (value !== "up" && value !== "down" && value !== null) throw new JourneyInputError("Choose an up or down vote.");
  const client = journeyClient();
  if (value === null) {
    const { data: published, error: readError } = await client.from("journeys").select("id").eq("id", id).eq("status", "published").maybeSingle();
    if (readError) throw new JourneyServiceError("Unable to cancel your vote. Please try again.");
    if (!published) throw new JourneyAccessError("This published journey is not available.");
    const { error } = await client.from("journey_votes").delete().eq("journey_id", id).eq("user_id", user.id);
    if (error) throw new JourneyServiceError("Unable to cancel your vote. Please try again.");
    return { value: null };
  }
  const { error } = await client.rpc("vote_on_journey", { p_user_id: user.id, p_journey_id: id, p_value: value });
  if (error) {
    if (error.message?.includes("published_journey_not_found")) throw new JourneyAccessError("This published journey is not available.");
    throw new JourneyServiceError("Unable to save your vote. Please try again.");
  }
  return { value };
}
