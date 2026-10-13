import type { Journey } from "@/utils/journeys/types";
import { journeyRoute, routeEmbedUrl } from "@/utils/journeys/maps";

export function RouteMap({ journey }: { journey: Journey }) {
  const route = journeyRoute(journey);
  const embed = routeEmbedUrl(route.places, process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY);
  return <section className="route-map" aria-label="Walking route">
    {embed && <iframe src={embed} title={`Walking route for ${journey.title}`} width="100%" height={240} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />}
    <a href={route.fullUrl} target="_blank" rel="noreferrer">Open full route in Google Maps</a>
  </section>;
}
