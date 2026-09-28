import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";

export type Caption = { id: string; text: string };
export class RatingInputError extends Error {}

// Private to rating operations; never exported as a general database client.
function ratingClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Server rating storage is not configured.");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error ? null : user;
}

export async function getRatingCaptions(): Promise<Caption[]> {
  if (!await authenticatedUser()) throw new Error("Sign in to rate captions.");
  const { data, error } = await ratingClient().from("captions")
    .select("id, text").order("id").limit(20);
  if (error) throw new Error("Unable to load captions. Please try again.");
  return data;
}

export async function insertCaptionVote(formData: FormData): Promise<
  { authenticated: false } | { authenticated: true; vote: "up" | "down" }
> {
  // Every mutation verifies through ordinary Auth BEFORE privileged access.
  const user = await authenticatedUser();
  if (!user) return { authenticated: false as const };

  const captionId = formData.get("caption_id");
  const vote = formData.get("vote");
  if (typeof captionId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(captionId)) {
    throw new RatingInputError("Choose a valid caption.");
  }
  if (vote !== "up" && vote !== "down") {
    throw new RatingInputError("Choose upvote or downvote.");
  }

  const client = ratingClient();
  const { data: caption, error: readError } = await client.from("captions")
    .select("id").eq("id", captionId).maybeSingle();
  if (readError) throw new Error("Unable to check the caption.");
  if (!caption) throw new RatingInputError("This caption is no longer available.");

  // No user_id or row contents from the browser are trusted. Always INSERT.
  const { error } = await client.from("caption_votes").insert({
    caption_id: caption.id, user_id: user.id, vote,
  });
  if (error) throw new Error("Unable to save your vote.");
  return { authenticated: true as const, vote };
}
