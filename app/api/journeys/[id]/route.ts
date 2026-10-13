import { getOwnDraft, getPublishedJourney } from "@/utils/supabase/journeys";
import { JourneyAuthError, JourneyInputError } from "@/utils/journeys/validation";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { id } = await context.params;
    const journey = await getPublishedJourney(id) ?? await getOwnDraft(id);
    return Response.json(journey ? { journey } : { error: "Journey not found." }, { status: journey ? 200 : 404, headers });
  } catch (error) {
    const status = error instanceof JourneyAuthError ? 404 : error instanceof JourneyInputError ? 400 : 503;
    return Response.json({ error: status === 404 ? "Journey not found." : "Unable to load this journey." }, { status, headers });
  }
}
