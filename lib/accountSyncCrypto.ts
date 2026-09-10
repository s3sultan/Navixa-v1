const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

export function normalizeSyncPassphrase(value: string) {
  return value.normalize("NFKC").trim();
}

function passphraseCandidates(value: string) {
  return [...new Set([
    value,
    value.normalize("NFC"),
    value.normalize("NFKC"),
    value.trim(),
    value.normalize("NFC").trim(),
    normalizeSyncPassphrase(value),
  ])].filter(Boolean);
}

async function deriveSyncKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSyncPayload(value: string, passphrase: string) {
  const normalized = normalizeSyncPassphrase(passphrase);
  if (normalized.length < 8) throw new Error("passphrase-too-short");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSyncKey(normalized, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return JSON.stringify({
    v: 2,
    alg: "AES-GCM",
    passphraseFormat: "NFKC-trim",
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(new Uint8Array(cipher)),
  });
}

export async function decryptSyncPayload(envelope: string, passphrase: string) {
  let box: { v?: number; alg?: string; passphraseFormat?: string; salt?: string; iv?: string; cipher?: string };
  try {
    box = JSON.parse(envelope);
  } catch {
    throw new Error("invalid-envelope");
  }
  if ((box.v !== 1 && box.v !== 2) || box.alg !== "AES-GCM" || !box.salt || !box.iv || !box.cipher) throw new Error("invalid-envelope");

  const candidates = box.v === 2 || box.passphraseFormat === "NFKC-trim"
    ? [normalizeSyncPassphrase(passphrase)]
    : passphraseCandidates(passphrase);
  if (!candidates[0]) throw new Error("passphrase-mismatch");

  const salt = base64ToBytes(box.salt);
  const iv = base64ToBytes(box.iv);
  const cipher = base64ToBytes(box.cipher);
  for (const candidate of candidates) {
    try {
      const key = await deriveSyncKey(candidate, salt);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
      return decoder.decode(plain);
    } catch {
      // Try the next canonical representation for legacy v1 backups.
    }
  }
  throw new Error("passphrase-mismatch");
}
