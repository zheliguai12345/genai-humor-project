"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveProfile } from "./actions";
import { avatarExtension, MAX_AVATAR_BYTES } from "@/utils/avatar-validation";
import type { Profile } from "@/utils/profile";

export function ProfileForm({ profile, avatarUrl }: { profile: Profile; avatarUrl: string | null }) {
  const [first, setFirst] = useState(profile.first_name ?? "");
  const [last, setLast] = useState(profile.last_name ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectionVersion = useRef(0);
  const [state, action, pending] = useActionState(async (previous: import("./actions").ProfileFormState, data: FormData) => { const result = await saveProfile(previous, data); if (result.saved) { setFilename(""); if (fileInput.current) fileInput.current.value = ""; } return result; }, {});
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const initials = `${Array.from(first.trim())[0] ?? ""}${Array.from(last.trim())[0] ?? ""}`.toUpperCase() || "E";
  const photo = preview ?? avatarUrl;
  async function changePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const version = ++selectionVersion.current;
    const file = event.target.files?.[0];
    setPhotoError("");
    if (!file) return;
    let error = "";
    if (file.size > MAX_AVATAR_BYTES) error = "Choose a photo smaller than 2 MB.";
    else if (!avatarExtension(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.type)) error = "Choose a JPEG, PNG, or WebP photo.";
    if (version !== selectionVersion.current) return;
    if (error) { setPhotoError(error); setPreview(null); setFilename(""); if (fileInput.current) fileInput.current.value = ""; return; }
    setPreview(URL.createObjectURL(file)); setFilename(file.name);
  }
  return <form action={action} className="profile-form">
    <div className="avatar-editor"><div className="avatar-circle">{photo && photo !== unavailable ?
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="Your profile photo" width={96} height={96} onError={() => { setUnavailable(photo); if (preview) { setPhotoError("Couldn't open this photo. Choose another."); setPreview(null); setFilename(""); if (fileInput.current) fileInput.current.value = ""; } }} />
      : <span role="img" aria-label="Your initials">{initials}</span>}</div>
      <div className="avatar-upload"><input ref={fileInput} id="avatar" name="avatar" type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={changePhoto} aria-describedby={photoError ? "photo-error" : filename ? "photo-selection" : undefined} />
        <label htmlFor="avatar" className="button secondary change-photo" role="button" tabIndex={pending ? -1 : 0} aria-disabled={pending} onClick={e => { if (pending) e.preventDefault(); }} onKeyDown={e => { if (!pending && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileInput.current?.click(); } }}>Change photo</label>
        {filename && <p id="photo-selection" className="hint selected-file">{filename} · {state.saved && !pending ? "Save profile to upload this selection." : "Save profile to upload."}</p>}
        {photoError && <p id="photo-error" role="alert" className="field-error">{photoError}</p>}</div></div>
    <label htmlFor="first_name">First name</label><input id="first_name" name="first_name" value={first} onChange={e => setFirst(e.target.value)} required maxLength={100} autoComplete="given-name" disabled={pending} />
    <label htmlFor="last_name">Last name</label><input id="last_name" name="last_name" value={last} onChange={e => setLast(e.target.value)} required maxLength={100} autoComplete="family-name" disabled={pending} />
    <button type="submit" className="button" disabled={pending || !!photoError}>{pending ? "Saving…" : "Save profile"}</button>
    {state.error && <p role="alert" className="field-error">{state.error}</p>}{state.saved && <p role="status" className="hint">Profile saved.</p>}
  </form>;
}
