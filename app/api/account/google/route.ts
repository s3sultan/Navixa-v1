import { NextResponse } from "next/server.js";
import { verifyGoogleCredential } from "../../auth/googleIdentity.ts";
import { resolveAdminJwtSecret } from "../../../../worker/adminAuth.ts";
import { clientIp, consumeAuthRateLimit } from "../../../../worker/authRateLimit.ts";
import { createOpaqueToken, createUserSession, getUserAuthSettings, hashOpaqueValue, isValidUserEmail, makeUserSessionCookie, normalizeUserEmail, trustedUserMutation, type D1Database } from "../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
const attempts = new Map<string, { count: number; resetAt: number }>();

async function db(): Promise<Database | null> {
  try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; }
  catch { return (globalThis as { DB?: Database }).DB || null; }
}

function consume(key: string) {
  const now = Date.now(), current = attempts.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + 10 * 60_000 } : current;
  bucket.count += 1;
  attempts.set(key, bucket);
  return bucket.count <= 8;
}

function rateLimitResponse(retryAfter = 600) {
  return NextResponse.json({ error: "عدد محاولات كبير، حاول بعد 10 دقائق" }, { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } });
}

/** Google credential يتحقق خادميًا؛ لا يقبل بريدًا أو user id من المتصفح. */
export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json({ error: "دخول NAVIXA غير متاح" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const settings = await getUserAuthSettings(database).catch(() => null);
  if (!settings?.userAuthEnabled) return NextResponse.json({ error: "دخول NAVIXA غير مفتوح بعد" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const ip = clientIp(request);
  if (!consume(`google:${ip}`)) return rateLimitResponse();
  const pepper = await resolveAdminJwtSecret();
  if (pepper) {
    const shared = await consumeAuthRateLimit(database, "google-auth-ip", ip, pepper, 8, 10 * 60_000);
    if (!shared.allowed) return rateLimitResponse(shared.retryAfterSeconds);
  }

  const body = await request.json().catch(() => ({})) as { credential?: unknown };
  const verified = await verifyGoogleCredential(typeof body.credential === "string" ? body.credential : "");
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: verified.status, headers: { "Cache-Control": "no-store" } });
  const email = normalizeUserEmail(verified.email);
  if (!isValidUserEmail(email)) return NextResponse.json({ error: "تعذر التحقق من بريد Google" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const now = new Date().toISOString(), emailHash = await hashOpaqueValue(email);
  const existing = await database.prepare("SELECT id,status FROM navixa_users WHERE email_hash=? LIMIT 1").bind(emailHash).all<{ id: string; status: "pending" | "active" | "suspended" }>();
  if (existing.results[0]?.status === "suspended") return NextResponse.json({ error: "هذا الحساب موقوف. تواصل مع دعم NAVIXA." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const userId = existing.results[0]?.id || crypto.randomUUID();
  if (!existing.results[0]) await database.prepare("INSERT INTO navixa_users(id,email,email_hash,webauthn_user_id,status,created_at,updated_at,last_login_at) VALUES (?,?,?,?, 'active',?,?,?)").bind(userId, email, emailHash, createOpaqueToken(), now, now, now).run();
  else await database.prepare("UPDATE navixa_users SET status='active',updated_at=?,last_login_at=? WHERE id=?").bind(now, now, userId).run();
  const session = await createUserSession(database, userId, request);
  return NextResponse.json({ ok: true, user: { email }, passkeysAvailable: settings.passkeysEnabled }, { headers: { "Set-Cookie": makeUserSessionCookie(session.token), "Cache-Control": "no-store" } });
}
