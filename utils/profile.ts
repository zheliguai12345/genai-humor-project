export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
};

export function needsNames(profile: Profile) {
  return !profile.first_name?.trim() || !profile.last_name?.trim();
}
