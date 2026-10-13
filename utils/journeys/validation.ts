import { BUDGETS, TIMES, VIBES, type GeneratedJourney, type GenerationInput, type ImageSelection, type JourneyImage } from "./types";

export class JourneyInputError extends Error {}
export class JourneyAuthError extends Error {}
export class JourneyAccessError extends Error {}
export class JourneyServiceError extends Error {}
export class JourneyOutputError extends Error {}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new JourneyInputError("Enter valid journey options.");
  return value as Record<string, unknown>;
}
export function validateInput(value: unknown): GenerationInput {
  const input = object(value);
  if (!TIMES.includes(input.time as GenerationInput["time"]) || !BUDGETS.includes(input.budget as GenerationInput["budget"])) {
    throw new JourneyInputError("Choose a time and budget.");
  }
  if (!Array.isArray(input.vibes) || input.vibes.length > VIBES.length || input.vibes.some(v => !VIBES.includes(v))) {
    throw new JourneyInputError("Choose valid interests.");
  }
  const wild = input.wild_idea ?? "";
  if (typeof wild !== "string" || Array.from(wild).length > 200) throw new JourneyInputError("Keep your wild idea within 200 characters.");
  return { time: input.time as GenerationInput["time"], budget: input.budget as GenerationInput["budget"],
    vibes: [...new Set(input.vibes)] as GenerationInput["vibes"], wild_idea: wild.trim() };
}
export function validateId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new JourneyInputError("Choose a valid journey.");
  }
  return value;
}
const journeyLimits = { title: 160, kicker: 100, hook: 400, premise: 1600,
  when_label: 160, budget_label: 100, area: 200, mode: 160, ending: 800, cover_image_query: 120 };
const stopLimits = { time_label: 80, title: 160, place: 300, body: 1600, move: 600, image_query: 120 };
function fields(value: unknown, limits: Record<string, number>): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new JourneyOutputError("The generated journey has missing fields.");
  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [key, max] of Object.entries(limits)) {
    const text = source[key];
    if (typeof text !== "string" || !text.trim()) throw new JourneyOutputError(`The generated ${key} is missing or too long.`);
    const normalized = key.endsWith("query") ? text.trim().split(/\s+/).slice(0, 6).join(" ") : text.trim();
    if (normalized.length > max) throw new JourneyOutputError(`The generated ${key} is missing or too long.`);
    if (key.endsWith("query") && normalized.split(/\s+/).length < 3) {
      throw new JourneyOutputError("An image query must contain at least 3 words.");
    }
    result[key] = normalized;
  }
  return result;
}
export function validateOutput(raw: string): GeneratedJourney {
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { throw new JourneyOutputError("The generated journey is not valid JSON."); }
  const result = fields(parsed, journeyLimits);
  if (!Array.isArray(parsed.stops) || parsed.stops.length < 3 || parsed.stops.length > 5) throw new JourneyOutputError("A journey needs 3 to 5 stops.");
  return { ...result, stops: parsed.stops.map(stop => fields(stop, stopLimits)) } as GeneratedJourney;
}
function schemaFields(limits: Record<string, number>) {
  return Object.fromEntries(Object.entries(limits).map(([key, maxLength]) => [key, { type: "string", minLength: 1, maxLength }]));
}
export const JOURNEY_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { ...schemaFields(journeyLimits), stops: { type: "array", minItems: 3, maxItems: 5, items: {
    type: "object", additionalProperties: false, properties: schemaFields(stopLimits), required: Object.keys(stopLimits),
  } } }, required: [...Object.keys(journeyLimits), "stops"],
};
export function validateSelections(value: unknown, positions: number[]): ImageSelection[] {
  if (!Array.isArray(value) || value.length !== positions.length) throw new JourneyInputError("Select a photo for the cover and every stop.");
  const seen = new Set<number>();
  return value.map(entry => {
    const selection = object(entry);
    const { position, candidate_index } = selection;
    if (Object.keys(selection).length !== 2 || !Number.isInteger(position) || !positions.includes(position as number) || seen.has(position as number) ||
      (candidate_index !== null && (!Number.isInteger(candidate_index) || (candidate_index as number) < 0 || (candidate_index as number) > 2))) {
      throw new JourneyInputError("Choose a valid photo selection.");
    }
    seen.add(position as number);
    return { position: position as number, candidate_index: candidate_index as number | null };
  });
}
export function selectImage(image: JourneyImage | null, index: number | null): JourneyImage | null {
  if (!image) {
    if (index !== null) throw new JourneyInputError("No photo is available for this position.");
    return null;
  }
  if (index === null || !image.candidates[index]) throw new JourneyInputError("Choose one of the available photos.");
  return { ...image.candidates[index], candidates: image.candidates };
}
