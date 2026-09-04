import { isTrustedSameOriginRequest, readCookie } from "./adminAuth.ts";

export const USER_SESSION_COOKIE = "__Host-navixa_session";
export const USER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const USER_SESSION_REFRESH_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};
export type D1Database = { prepare: (sql: string) => D1Statement };
export type UserDeviceClass = "computer" | "mobile";

export type UserAuthSettings = {
  userAuthEnabled: boolean;
  emailOtpEnabled: boolean;
  passkeysEnabled: boolean;
  earlyAccessEnabled: boolean;
  telegramBotEnabled: boolean;
  telegramBackgroundAlertsEnabled: boolean;
  trialDays: number;
};

export type UserSession = {
  userId: string;
  email: string;
  status: "pending" | "active" | "suspended";
  expiresAt: string;
};

const defaults: UserAuthSettings = {
  userAuthEnabled: false,
  emailOtpEnabled: false,
  passkeysEnabled: false,
  earlyAccessEnabled: false,
  telegramBotEnabled: false,
  telegramBackgroundAlertsEnabled: false,
  trialDays: 14,
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function mutationChanges(result: unknown) {
  const changes = (result as { meta?: { changes?: unknown } } | null)?.meta?.changes;
  return typeof changes === "number" ? changes : null;
}

export function normalizeUserEmail(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, "").trim().toLowerCase().slice(0, 160) : "";
}

export function isValidUserEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function hashOpaqueValue(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return base64Url(new Uint8Array(digest));
}

export function createOpaqueToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

export function resolveUserDeviceClass(request: Request): UserDeviceClass {
  const clientHint = (request.headers.get("sec-ch-ua-mobile") || "").trim();
  if (clientHint === "?1") return "mobile";
  if (clientHint === "?0") return "computer";
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  return /android|iphone|ipad|ipod|mobile|windows phone|opera mini|opera mobi/.test(userAgent) ? "mobile" : "computer";
}

export async function getUserAuthSettings(database: D1Database): Promise<UserAuthSettings> {
  const rows = await database.prepare("SELECT setting_key,setting_value FROM navixa_user_auth_settings").all<{ setting_key: string; setting_value: string }>();
  const values = new Map(rows.results.map(row => [row.setting_key, row.setting_value]));
  const trialValue = Number(values.get("trial_days") || defaults.trialDays);
  return {
    userAuthEnabled: values.get("user_auth_enabled") === "true",
    emailOtpEnabled: values.get("email_otp_enabled") === "true",
    passkeysEnabled: values.get("passkeys_enabled") === "true",
    earlyAccessEnabled: values.get("early_access_enabled") === "true",
    telegramBotEnabled: values.get("telegram_bot_enabled") === "true",
    telegramBackgroundAlertsEnabled: values.get("telegram_background_alerts_enabled") === "true",
    trialDays: Number.isInteger(trialValue) && trialValue >= 1 && trialValue <= 31 ? trialValue : defaults.trialDays,
  };
}

export function readUserSessionToken(request: Request) {
  return readCookie(request, USER_SESSION_COOKIE);
}

export async function resolveUserSession(request: Request, database: D1Database): Promise<UserSession | null> {
  const token = readUserSessionToken(request);
  if (!token || token.length < 30) return null;
  const tokenHash = await hashOpaqueValue(token);
  const rows = await database.prepare(
    "SELECT s.user_id,u.email,u.status,s.expires_at FROM navixa_user_sessions s JOIN navixa_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at='' AND s.device_class IN ('computer','mobile') LIMIT 1",
  ).bind(tokenHash).all<{ user_id: string; email: string; status: UserSession["status"]; expires_at: string }>();
  const row = rows.results[0];
  if (!row || Date.parse(row.expires_at) <= Date.now() || row.status === "suspended") return null;
  return { userId: row.user_id, email: row.email, status: row.status, expiresAt: row.expires_at };
}

export async function createUserSession(database: D1Database, userId: string, request: Request) {
  const token = createOpaqueToken();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + USER_SESSION_TTL_SECONDS * 1000).toISOString();
  const deviceClass = resolveUserDeviceClass(request);
  await database.prepare("UPDATE navixa_user_sessions SET revoked_at=? WHERE user_id=? AND device_class=? AND revoked_at='' ").bind(nowIso, userId, deviceClass).run();
  await database.prepare("INSERT INTO navixa_user_sessions(id,user_id,token_hash,created_at,expires_at,last_seen_at,revoked_at,device_class) VALUES (?,?,?,?,?,?, '',?)").bind(crypto.randomUUID(), userId, await hashOpaqueValue(token), nowIso, expiresAt, nowIso, deviceClass).run();
  return { token, expiresAt, deviceClass };
}

export async function refreshUserSessionIfNeeded(request: Request, database: D1Database, session: UserSession): Promise<{ session: UserSession; cookie: string | null }> {
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() > USER_SESSION_REFRESH_WINDOW_SECONDS * 1000) return { session, cookie: null };
  const token = readUserSessionToken(request);
  if (!token || token.length < 30) return { session, cookie: null };

  const nowIso = new Date().toISOString();
  const nextExpiresAt = new Date(Date.now() + USER_SESSION_TTL_SECONDS * 1000).toISOString();
  const nextToken = createOpaqueToken();
  const currentHash = await hashOpaqueValue(token);
  const nextHash = await hashOpaqueValue(nextToken);

  // Rotate the bearer token when extending a session. A stolen old token can no
  // longer keep refreshing itself indefinitely. The old hash is the compare-and-
  // swap key, so only one concurrent refresh can win in production D1.
  const result = await database.prepare(
    "UPDATE navixa_user_sessions SET expires_at=?,last_seen_at=?,token_hash=? WHERE token_hash=? AND revoked_at=''",
  ).bind(nextExpiresAt, nowIso, nextHash, currentHash).run();
  if (mutationChanges(result) === 0) return { session, cookie: null };

  return { session: { ...session, expiresAt: nextExpiresAt }, cookie: makeUserSessionCookie(nextToken) };
}

export async function revokeUserSession(request: Request, database: D1Database) {
  const token = readUserSessionToken(request);
  if (!token || token.length < 30) return;
  await database.prepare("UPDATE navixa_user_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at=''").bind(new Date().toISOString(), await hashOpaqueValue(token)).run();
}

export function makeUserSessionCookie(token: string) {
  return `${USER_SESSION_COOKIE}=${token}; Path=/; Max-Age=${USER_SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearUserSessionCookie() {
  return `${USER_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function trustedUserMutation(request: Request) {
  return isTrustedSameOriginRequest(request);
}