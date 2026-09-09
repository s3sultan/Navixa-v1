// NAVIXA private pilot access.
// Pilot identity is checked only on the server against an authenticated session.
// Keep the account identifier out of client bundles and out of plaintext source.
const NAVIXA_PILOT_EMAIL_SHA256 = "xr801Wj5eiQjOxT-_RIwfOp5_EBxqbnMVD89P9wmO60";
const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function isNavixaPilotEmail(email: string | null | undefined): Promise<boolean> {
  const normalized = email?.replace(/\s+/g, "").trim().toLowerCase() || "";
  if (!normalized) return false;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(normalized));
  return base64Url(new Uint8Array(digest)) === NAVIXA_PILOT_EMAIL_SHA256;
}
