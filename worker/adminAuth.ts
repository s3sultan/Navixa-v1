export const ADMIN_SESSION_COOKIE = "__Host-navixa_admin_session";
export const ADMIN_SESSION_AUDIENCE = "navixa-admin";
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type AdminSessionClaims = {
  sub: string;
  email: string;
  aud: typeof ADMIN_SESSION_AUDIENCE;
  iat: number;
  exp: number;
};

type JwtHeader = { alg: "HS256"; typ: "JWT" };

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function encodeJson(value: unknown) {
  return encodeBase64Url(encoder.encode(JSON.stringify(value)));
}

function parseJson<T>(value: string): T | null {
  try { return JSON.parse(decoder.decode(decodeBase64Url(value))) as T; } catch { return null; }
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

function isValidClaims(value: unknown): value is AdminSessionClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Partial<AdminSessionClaims>;
  return typeof claims.sub === "string" && typeof claims.email === "string" && claims.aud === ADMIN_SESSION_AUDIENCE && Number.isInteger(claims.iat) && Number.isInteger(claims.exp);
}

export async function createAdminSessionToken(email: string, secret: string, nowMs = Date.now()) {
  if (!secret || secret.length < 32) throw new Error("ADMIN_JWT_SECRET must be at least 32 characters");
  const now = Math.floor(nowMs / 1000);
  const claims: AdminSessionClaims = { sub: email.toLowerCase(), email: email.toLowerCase(), aud: ADMIN_SESSION_AUDIENCE, iat: now, exp: now + ADMIN_SESSION_TTL_SECONDS };
  const encodedHeader = encodeJson({ alg: "HS256", typ: "JWT" } satisfies JwtHeader);
  const encodedClaims = encodeJson(claims);
  const unsigned = `${encodedHeader}.${encodedClaims}`;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(unsigned)));
  return `${unsigned}.${encodeBase64Url(signature)}`;
}

export async function verifyAdminSessionToken(token: string | undefined, secret: string, nowMs = Date.now()) {
  if (!token || !secret) return null;
  const segments = token.split(".");
  if (segments.length !== 3) return null;
  const [encodedHeader, encodedClaims, encodedSignature] = segments;
  const header = parseJson<Partial<JwtHeader>>(encodedHeader);
  const claims = parseJson<unknown>(encodedClaims);
  if (header?.alg !== "HS256" || header.typ !== "JWT" || !isValidClaims(claims)) return null;
  try {
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(`${encodedHeader}.${encodedClaims}`)));
    const received = decodeBase64Url(encodedSignature);
    if (!timingSafeEqual(expected, received) || claims.exp <= Math.floor(nowMs / 1000)) return null;
    return claims;
  } catch { return null; }
}

export function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const segment of cookie.split(";")) {
    const [key, ...parts] = segment.trim().split("=");
    if (key === name) return parts.join("=") || undefined;
  }
  return undefined;
}

export function makeAdminSessionCookie(token: string) {
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=/; Max-Age=${ADMIN_SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminSessionCookie() {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function isProtectedAdminPath(pathname: string) {
  return (pathname === "/admin" || pathname.startsWith("/admin/")) && pathname !== "/admin/login";
}

export function isProtectedAdminApiPath(pathname: string) {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

export function isTrustedSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
}

export type MemoryRateLimiter = { consume: (key: string, limit: number, windowMs: number) => { allowed: boolean; retryAfterSeconds: number } };

export function createMemoryRateLimiter(clock: () => number = () => Date.now()): MemoryRateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    consume(key, limit, windowMs) {
      const now = clock();
      const current = buckets.get(key);
      const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
      bucket.count += 1;
      buckets.set(key, bucket);
      return { allowed: bucket.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    },
  };
}

export async function resolveAdminJwtSecret() {
  try {
    const binding = await import("cloudflare:workers") as { env?: { ADMIN_JWT_SECRET?: string } };
    if (binding.env?.ADMIN_JWT_SECRET) return binding.env.ADMIN_JWT_SECRET;
  } catch { /* Local tests and non-Worker runtimes have no cloudflare module. */ }
  return (globalThis as { ADMIN_JWT_SECRET?: string }).ADMIN_JWT_SECRET || (typeof process !== "undefined" ? process.env.ADMIN_JWT_SECRET : undefined) || undefined;
}
