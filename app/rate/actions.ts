"use server";

import { insertCaptionVote, RatingInputError } from "@/utils/supabase/rating";

export type VoteFormState = { error?: string; saved?: "up" | "down" };

export async function submitVote(_previous: VoteFormState, formData: FormData): Promise<VoteFormState> {
  try {
    const result = await insertCaptionVote(formData);
    if (!result.authenticated) return { error: "Sign in to rate captions." };
    return { saved: result.vote };
  } catch (error) {
    return { error: error instanceof RatingInputError ? error.message : "We couldn't save your vote. Please try again." };
  }
}
