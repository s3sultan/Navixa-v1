const encoder = new TextEncoder();

const isHexSignature = (value: string) => /^[a-f0-9]{64}$/i.test(value);
const isIntentId = (value: string) => /^[a-zA-Z0-9_-]{16,128}$/.test(value);

export function fixedTimeEqualHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifySallaWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  secret: string | undefined;
}) {
  const signature = input.signature?.trim().toLowerCase() || "";
  if (!input.secret || !isHexSignature(signature)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(input.rawBody)));
  const expected = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return fixedTimeEqualHex(expected, signature);
}

/**
 * رابط العودة هو واجهة للمستخدم فقط. لا يحمل إشارة نجاح دفع ولا يمنح استحقاقًا.
 * تؤكد NAVIXA الحالة لاحقًا عبر Webhook موقّع واستعلام خادمي عند ربط سلة فعليًا.
 */
export function buildSallaReturnUrl(origin: string, intentId: string) {
  if (!isIntentId(intentId)) throw new Error("Invalid NAVIXA billing intent");
  const url = new URL("/plus/complete", origin);
  url.searchParams.set("intent", intentId);
  url.searchParams.set("provider", "salla");
  return url.toString();
}

export function parseSallaReturnIntent(value: string | null) {
  return value && isIntentId(value) ? value : null;
}
