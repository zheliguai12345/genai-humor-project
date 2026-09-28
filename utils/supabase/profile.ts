import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";
import { avatarExtension, MAX_AVATAR_BYTES } from "../avatar-validation";
import type { Profile } from "../profile";

export class ProfileInputError extends Error {}

// Private to this module. It is never exported as a general database client.
function profileStorageClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Server profile storage is not configured.");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error ? null : user;
}

function ownsAvatar(userId: string, path: string) {
  return path.startsWith(`${userId}/avatar-`) &&
    /^[0-9a-f-]+\/avatar-[0-9a-f-]+\.(png|jpg|webp)$/.test(path);
}

export async function getCurrentProfile() {
  // Verify through the ordinary SSR Auth client BEFORE using the secret client.
  const user = await authenticatedUser();
  if (!user) return null;
  const client = profileStorageClient();
  const { data, error } = await client.from("profiles")
    .select("id, first_name, last_name, avatar_path").eq("id", user.id).single();
  if (error || !data) throw new Error("Unable to load the current user's profile.");
  const profile = data as Profile;
  let avatarUrl: string | null = null;
  if (profile.avatar_path && ownsAvatar(user.id, profile.avatar_path)) {
    const { data: avatar, error: avatarError } = await client.storage.from("avatars")
      .createSignedUrl(profile.avatar_path, 600);
    if (avatarError) throw new Error("Unable to load the current user's avatar.");
    avatarUrl = avatar.signedUrl;
  }
  return { profile, avatarUrl };
}

export async function saveCurrentProfile(formData: FormData) {
  const user = await authenticatedUser();
  if (!user) return { authenticated: false as const };

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
    throw new ProfileInputError("Enter both names, using at most 100 characters each.");
  }
  const avatar = formData.get("avatar");
  let bytes: Uint8Array | null = null;
  let extension: string | null = null;
  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > MAX_AVATAR_BYTES) throw new ProfileInputError("Choose a photo smaller than 2 MB.");
    bytes = new Uint8Array(await avatar.arrayBuffer());
    extension = avatarExtension(bytes, avatar.type);
    if (!extension) throw new ProfileInputError("Choose a valid JPEG, PNG, or WebP photo.");
  }

  const client = profileStorageClient();
  const { data: existing, error: readError } = await client.from("profiles")
    .select("avatar_path").eq("id", user.id).single();
  if (readError || !existing) throw new Error("Unable to load the current user's profile.");
  let newPath: string | null = null;
  if (bytes && extension && avatar instanceof File) {
    // Neither the user ID nor an object path is accepted from the submitted form.
    newPath = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("avatars").upload(newPath, bytes, {
      contentType: avatar.type, upsert: false, cacheControl: "3600",
    });
    if (error) throw new Error("Unable to upload the current user's avatar.");
  }

  const { error: updateError } = await client.from("profiles").update({
    first_name: firstName,
    last_name: lastName,
    ...(newPath ? { avatar_path: newPath } : {}),
  }).eq("id", user.id);
  if (updateError) {
    if (newPath) await client.storage.from("avatars").remove([newPath]);
    throw new Error("Unable to save the current user's profile.");
  }
  if (newPath && existing.avatar_path && ownsAvatar(user.id, existing.avatar_path)) {
    // Remove only this user's previous avatar after the new reference persists.
    await client.storage.from("avatars").remove([existing.avatar_path]);
  }
  return { authenticated: true as const };
}
