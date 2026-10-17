export function validateProfileImage(profileImage) {
  if (profileImage === undefined) {
    return { ok: true, value: undefined };
  }

  if (profileImage === null || profileImage === "") {
    return { ok: true, value: null };
  }

  if (typeof profileImage !== "string") {
    return { ok: false, message: "Profile image must be a JPEG image." };
  }

  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(profileImage);
  if (!match) {
    return { ok: false, message: "Use a JPEG, PNG, or WebP image. The photo is converted to JPEG before saving." };
  }

  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return { ok: false, message: "The uploaded file is not a valid JPEG image." };
  }

  if (bytes.length > 350 * 1024) {
    return { ok: false, message: "Profile photos must be smaller than 350 KB after compression. Please choose another photo." };
  }

  return { ok: true, value: profileImage };
}
