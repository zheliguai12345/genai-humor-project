"use server";
import { revalidatePath } from "next/cache";
import { generateJourney, getGenerationQuota, publishJourney as publish, voteOnJourney } from "@/utils/supabase/journeys";
import { JourneyAccessError, JourneyAuthError, JourneyInputError, JourneyServiceError } from "@/utils/journeys/validation";

function message(error: unknown) {
  return error instanceof JourneyAuthError || error instanceof JourneyInputError ||
    error instanceof JourneyAccessError || error instanceof JourneyServiceError
    ? error.message : "We couldn't complete that request. Please try again.";
}
export async function createJourney(input: unknown) {
  try { return { data: await generateJourney(input) }; }
  catch (error) {
    const quota = error instanceof JourneyAuthError ? undefined : await getGenerationQuota().catch(() => undefined);
    return { error: message(error), quota };
  }
}
export async function publishJourney(id: string, selections: unknown) {
  try {
    const result = await publish(id, selections);
    revalidatePath("/"); revalidatePath("/discover");
    revalidatePath(`/journeys/${id}`); revalidatePath(`/preview/${id}`);
    return { data: result };
  } catch (error) { return { error: message(error) }; }
}
export async function vote(id: string, value: unknown) {
  try {
    const result = await voteOnJourney(id, value);
    revalidatePath("/");
    revalidatePath(`/journeys/${id}`);
    return { data: result };
  } catch (error) { return { error: message(error) }; }
}
