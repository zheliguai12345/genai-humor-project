import { generateJourney, getGenerationQuota, getPublishedJourneys } from "@/utils/supabase/journeys";
import { getOptionalUser } from "@/utils/supabase/server";
import { JourneyAuthError, JourneyInputError, JourneyServiceError, validateInput } from "@/utils/journeys/validation";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store" };
async function readOptions(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}
export async function GET() {
  try { return Response.json({ journeys: await getPublishedJourneys() }, { headers }); }
  catch { return Response.json({ error: "Unable to load journeys." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  // Unlike Server Actions, Route Handlers need an explicit same-origin mutation check.
  // Next's internal URL can use a different port behind a reverse proxy.
  // Compare the browser Origin with the HTTP Host, as Server Actions do.
  const host = request.headers.get("host");
  if (!host || request.headers.get("origin") !== `${new URL(request.url).protocol}//${host}`) {
    return Response.json({ error: "This request is not allowed." }, { status: 403, headers });
  }
  try {
    const text = await readOptions(request);
    if (text === null) return Response.json({ error: "The journey options are too large." }, { status: 413, headers });
    let input: unknown;
    try { input = JSON.parse(text); } catch { return Response.json({ error: "Enter valid journey options." }, { status: 400, headers }); }
    if (request.headers.get("accept") === "application/x-ndjson") {
      if (!await getOptionalUser()) return Response.json({ error: "Sign in to continue." }, { status: 401, headers });
      input = validateInput(input);
      const encoder = new TextEncoder();
      const cancelled = new AbortController();
      let closed = false;
      const stream = new ReadableStream({
        async start(controller) {
          const send = (event: unknown) => { if (!closed) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
          try {
            const data = await generateJourney(input, progress => send({ type: "progress", ...progress }), AbortSignal.any([request.signal, cancelled.signal]));
            send({ type: "complete", data });
          } catch (error) {
            const message = error instanceof JourneyAuthError || error instanceof JourneyInputError || error instanceof JourneyServiceError
              ? error.message : "We couldn't complete this journey. Please try again.";
            const quota = await getGenerationQuota().catch(() => undefined);
            send({ type: "error", error: message, quota });
          } finally { if (!closed) { closed = true; controller.close(); } }
        },
        cancel() { closed = true; cancelled.abort(); },
      });
      return new Response(stream, { headers: { ...headers, "Content-Type": "application/x-ndjson", "X-Content-Type-Options": "nosniff", "X-Accel-Buffering": "no" } });
    }
    return Response.json(await generateJourney(input), { status: 201, headers });
  } catch (error) {
    if (error instanceof JourneyAuthError) return Response.json({ error: error.message }, { status: 401, headers });
    if (error instanceof JourneyInputError) return Response.json({ error: error.message }, { status: 400, headers });
    return Response.json({ error: "We couldn't complete this journey. Please try again." }, { status: 503, headers });
  }
}
