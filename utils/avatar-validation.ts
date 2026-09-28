export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function avatarExtension(bytes: Uint8Array, mime: string) {
  const begins = (signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (mime === "image/png" && begins([137, 80, 78, 71, 13, 10, 26, 10])) return "png";
  if (mime === "image/jpeg" && begins([255, 216, 255])) return "jpg";
  if (
    mime === "image/webp" && begins([82, 73, 70, 70]) &&
    bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80
  ) return "webp";
  return null;
}
