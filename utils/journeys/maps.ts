import type { Journey } from "./types";

// Verified map anchors only; Journey copy and stored places remain unchanged.
const routeAnchors: Record<string, Record<number, string>> = {
  "e15e0000-0000-4000-8000-000000000001": {
    1: "Greene Street & Canal Street", 2: "Greene Street & Grand Street",
    4: "Nom Wah Tea Parlor, 13 Doyers Street",
  },
  "e15e0000-0000-4000-8000-000000000004": { 2: "Fifth Avenue & East 82nd Street" },
  "6403573b-eb79-4d9b-915a-fc188ca15133": { 3: "49th Ave & 21st St" },
};
export function specificMapPlace(place: string): boolean {
  if (!place.trim() || /\b(any|anywhere|somewhere|successor|or)\b|on your way|look up|[\/|]/i.test(place)
    || /^(a |an |the nearest |your |new york(?: city)?$|manhattan$|brooklyn$|queens$|downtown$|uptown$)/i.test(place)) return false;
  return /\b(street|st|avenue|ave|road|rd|broadway|plaza|park|garden|bridge|tavern|museum|shop|store|grocery|cafe|café|library|station|terminal|hall|market)\b|\d/i.test(place)
    || /^[A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+)*$/u.test(place);
}
export function mapQuery(place: string): string {
  const input = place.trim();
  const categoryStop = /^(Any|A)\s+/i.test(input);
  // Strip the entire generic venue prefix before splitting address segments.
  const onLocation = categoryStop ? input.match(/\s+on\s+(.+)$/i)?.[1].trim() : undefined;
  const parts = (onLocation ?? input).split(/[·,]/).map(part => part.trim()).filter(Boolean);
  const descriptive = /\b(looking|toward|towards|corner|stop|block)\b/i;
  const address = /\d|\b(street|st|avenue|ave|broadway|pl|place|plaza|park|road|rd|blvd|boulevard|way|drive|dr|lane|ln)\b|&/i;
  const neighborhood = /^[A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+)*$/u;
  const locations = parts.flatMap((part, index) => {
    if (categoryStop) {
      // Generic venues map to their street/neighborhood, never to a guessed business.
      const location = index === 0 && !onLocation ? part.match(/\b(?:on|at|along|near|in)\s+(.+)$/i)?.[1].trim() ?? "" : part;
      return location && !/^[a-z]/.test(location) && !descriptive.test(location) &&
        (address.test(location) || neighborhood.test(location)) ? [location] : [];
    }
    if (index === 0) {
      // Keep the venue identity, dropping an appended narrative qualifier such as "block".
      const name = part.replace(/\s+\b(block|stop|corner|looking|toward|towards)\b.*$/i, "").trim();
      return name && !/^[a-z]/.test(name) ? [name] : [];
    }
    return !/^[a-z]/.test(part) && !descriptive.test(part) && address.test(part) ? [part] : [];
  });
  return `${locations.join(", ")}, New York City`;
}
export function journeyRoute(journey: Pick<Journey, "id" | "stops">) {
  const places = [...journey.stops].sort((a, b) => a.position - b.position).map(stop =>
    routeAnchors[journey.id]?.[stop.position] ?? stop.place).map(mapQuery)
    .filter(query => specificMapPlace(query.replace(/, New York City$/, "")));
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
