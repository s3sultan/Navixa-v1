"use client";

export const GOOGLE_CLIENT_ID = "876266145464-i4pigjbevro3ki0d0lj0gds6geivecvb.apps.googleusercontent.com";
const ADMIN_EMAIL = "s2shug@gmail.com";
const STORAGE_KEY = "navixa_admin_google_token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

type JwtHeader = { alg?: string; kid?: string };
type JwtPayload = {
  aud?: string | string[];
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  iss?: string;
};
type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

let cachedKeys: { keys: Jwk[]; expiresAt: number } | null = null;

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

function isAudienceAllowed(audience: JwtPayload["aud"]) {
  return Array.isArray(audience) ? audience.includes(GOOGLE_CLIENT_ID) : audience === GOOGLE_CLIENT_ID;
}

async function getGoogleKeys() {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;

  const response = await fetch(JWKS_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("تعذر الوصول إلى مفاتيح Google العامة.");
  const payload = await response.json() as { keys?: Jwk[] };
  if (!payload.keys?.length) throw new Error("لم تصل مفاتيح تحقق Google.");

  cachedKeys = { keys: payload.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return cachedKeys.keys;
}

export async function verifyGoogleAdminToken(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, error: "لم يصل رمز Google بصيغة صحيحة." };

    const header = decodeJson<JwtHeader>(parts[0]);
    const claims = decodeJson<JwtPayload>(parts[1]);
    if (header.alg !== "RS256" || !header.kid) return { ok: false, error: "رمز Google يستخدم توقيعًا غير متوقع." };

    const key = (await getGoogleKeys()).find((candidate) => candidate.kid === header.kid);
    if (!key) return { ok: false, error: "مفتاح توقيع Google غير متاح حاليًا. أعد المحاولة بعد لحظة." };

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signatureValid = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      cryptoKey,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!signatureValid) return { ok: false, error: "تعذر التحقق من توقيع Google." };

    const validIssuer = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
    const verifiedEmail = claims.email_verified === true || claims.email_verified === "true";
    const notExpired = typeof claims.exp === "number" && claims.exp * 1000 > Date.now() + 5000;
    if (!validIssuer || !isAudienceAllowed(claims.aud) || !verifiedEmail || !notExpired) {
      return { ok: false, error: "رمز Google غير صالح أو انتهت صلاحيته." };
    }
    if (claims.email?.toLowerCase() !== ADMIN_EMAIL) {
      return { ok: false, error: "هذا الحساب غير مخوّل لدخول الإدارة." };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر التحقق من رمز Google.";
    return { ok: false, error: message };
  }
}

export function saveAdminToken(token: string) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function readAdminToken() {
  return sessionStorage.getItem(STORAGE_KEY) || "";
}
