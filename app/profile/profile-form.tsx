"use client";

import { useActionState } from "react";
import { saveProfile } from "./actions";
import type { Profile } from "@/utils/profile";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(saveProfile, {});
  return <form action={action} className="profile-form">
    <label htmlFor="first_name">First name</label>
    <input id="first_name" name="first_name" defaultValue={profile.first_name ?? ""} required maxLength={100} autoComplete="given-name" />
    <label htmlFor="last_name">Last name</label>
    <input id="last_name" name="last_name" defaultValue={profile.last_name ?? ""} required maxLength={100} autoComplete="family-name" />
    <label htmlFor="avatar">Profile photo</label>
    <input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" />
    <p className="hint">JPEG, PNG, or WebP, up to 2 MB. Leave blank to keep your current photo.</p>
    <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    {state.error && <p role="alert">{state.error}</p>}
    {state.saved && <p role="status">Profile saved.</p>}
  </form>;
}
