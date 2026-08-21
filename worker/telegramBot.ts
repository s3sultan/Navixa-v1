const encoder = new TextEncoder();
const decoder = new TextDecoder();

type RuntimeTelegramEnv = {
  NAVIXA_TELEGRAM_BOT_TOKEN?: string;
  NAVIXA_TELEGRAM_WEBHOOK_SECRET?: string;
  NAVIXA_TELEGRAM_ENCRYPTION_KEY?: string;
  NAVIXA_TELEGRAM_BOT_USERNAME?: string;
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function telegramRuntimeEnv(): Promise<RuntimeTelegramEnv> {
  try {
    return ((await import("cloudflare:workers") as { env?: RuntimeTelegramEnv }).env || {});
  } catch {
    return (globalThis as { __NAVIXA_TELEGRAM_ENV__?: RuntimeTelegramEnv }).__NAVIXA_TELEGRAM_ENV__ || {};
  }
}

export async function hashTelegramValue(value: string, secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${secret}:${value}`));
  return base64Url(new Uint8Array(digest));
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptTelegramIdentifier(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptTelegramIdentifier(value: string, secret: string) {
  const [ivPart, ciphertextPart, extra] = value.split(".");
  if (!ivPart || !ciphertextPart || extra) throw new Error("Invalid Telegram ciphertext");
  const key = await encryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(ivPart) }, key, fromBase64Url(ciphertextPart));
  return decoder.decode(plaintext);
}

export function validTelegramLinkToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(value);
}

export function validTelegramChatId(value: unknown): value is string {
  return typeof value === "string" && /^-?\d{4,20}$/.test(value);
}

export async function sendOfficialTelegramMessage(input: { chatId: string; text: string; token: string }) {
  const response = await fetch(`https://api.telegram.org/bot${input.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: input.chatId, text: input.text.slice(0, 3500), disable_web_page_preview: true }),
  });
  return response.ok;
}
