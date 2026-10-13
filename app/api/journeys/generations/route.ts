import { getOwnGenerationRuns } from "@/utils/supabase/journeys";
import { JourneyAuthError } from "@/utils/journeys/validation";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try { return Response.json({ runs: await getOwnGenerationRuns() }, { headers }); }
  catch (error) {
    return Response.json({ error: error instanceof JourneyAuthError ? error.message : "Unable to load your history." },
      { status: error instanceof JourneyAuthError ? 401 : 503, headers });
  }
}
