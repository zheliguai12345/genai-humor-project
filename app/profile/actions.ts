"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProfileInputError, saveCurrentProfile } from "@/utils/supabase/profile";

export type ProfileFormState = { error?: string; saved?: boolean };

export async function saveProfile(_previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  let authenticated: boolean;
  try {
    authenticated = (await saveCurrentProfile(formData)).authenticated;
  } catch (error) {
    return { error: error instanceof ProfileInputError ? error.message : "We couldn't save your profile. Please try again." };
  }
  if (!authenticated) redirect("/");
  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/rate");
  return { saved: true };
}
