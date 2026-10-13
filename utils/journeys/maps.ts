import type { Journey } from "./types";

// Editorial map anchors only; the approved Journey copy and database remain unchanged.
const editorialAnchors: Record<string, Record<number, string>> = {
  "e15e0000-0000-4000-8000-000000000001": {
    1: "Greene Street & Canal Street", 2: "Greene Street & Grand Street",
    4: "Nom Wah Tea Parlor, 13 Doyers Street",
  },
  "e15e0000-0000-4000-8000-000000000004": { 2: "Fifth Avenue & East 82nd Street" },
};
export function specificMapPlace(place: string): boolean {
  if (!place.trim() || /\b(any|anywhere|somewhere|successor|or)\b|on your way|look up|[\/|]/i.test(place)
    || /^(a |an |the nearest |your |new york(?: city)?$|manhattan$|brooklyn$|queens$|downtown$|uptown$)/i.test(place)) return false;
  return /\b(street|st|avenue|ave|road|rd|broadway|plaza|park|garden|bridge|tavern|museum|shop|store|grocery|cafe|café|library|station|terminal|hall|market)\b|\d/i.test(place)
    || /^[A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+)*$/u.test(place);
}
export function journeyRoute(journey: Pick<Journey, "id" | "stops">) {
  const places = [...journey.stops].sort((a, b) => a.position - b.position).map(stop =>
    editorialAnchors[journey.id]?.[stop.position] ?? stop.place).filter(specificMapPlace).map(place => `${place}, New York, NY`);
  const parameters = new URLSearchParams({ api: "1", travelmode: "walking" });
  if (places.length) {
    parameters.set("origin", places[0]); parameters.set("destination", places[places.length - 1]);
    if (places.length > 2) parameters.set("waypoints", places.slice(1, -1).join("|"));
  }
  return { places, fullUrl: `https://www.google.com/maps/dir/?${parameters}` };
}
export function routeEmbedUrl(places: string[], key: string | undefined) {
  if (!key || places.length < 2) return null;
  const parameters = new URLSearchParams({ key, origin: places[0], destination: places[places.length - 1], mode: "walking" });
  if (places.length > 2) parameters.set("waypoints", places.slice(1, -1).join("|"));
  return `https://www.google.com/maps/embed/v1/directions?${parameters}`;
}
