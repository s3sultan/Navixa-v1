import { NextResponse } from "next/server.js";
import { createOpaqueToken, createUserSession, getUserAuthSettings, hashOpaqueValue, isValidUserEmail, makeUserSessionCookie, normalizeUserEmail, trustedUserMutation, type D1Database } from "../../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type Env = Record<string, string | undefined>;
const attempts = new Map<string, { count: number; resetAt: number }>();

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
async function env(): Promise<Env> { try { return (await import("cloudflare:workers") as { env?: Env }).env || {}; } catch { return globalThis as Env; } }
function consume(key: string) { const now = Date.now(), existing = attempts.get(key); const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + 10 * 60_000 } : existing; bucket.count += 1; attempts.set(key, bucket); return bucket.count <= 8; }
function code(value: unknown) { return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 6) : ""; }

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json({ error: "دخول NAVIXA غير متاح" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const settings = await getUserAuthSettings(database).catch(() => null), secrets = await env();
  if (!settings?.userAuthEnabled || !settings.emailOtpEnabled || !secrets.NAVIXA_AUTH_CODE_PEPPER) return NextResponse.json({ error: "دخول NAVIXA غير مفتوح بعد" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const body = await request.json().catch(() => ({})) as { email?: unknown; code?: unknown };
  const email = normalizeUserEmail(body.email), loginCode = code(body.code), ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "anonymous";
  if (!consume(`verify:${ip}`)) return NextResponse.json({ error: "عدد محاولات كبير، حاول بعد 10 دقائق" }, { status: 429, headers: { "Retry-After": "600", "Cache-Control": "no-store" } });
  if (!isValidUserEmail(email) || loginCode.length !== 6) return NextResponse.json({ error: "تحقق من البريد والرمز" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const emailHash = await hashOpaqueValue(email), expected = await hashOpaqueValue(`${email}:${loginCode}:${secrets.NAVIXA_AUTH_CODE_PEPPER}`), now = new Date().toISOString();
  const codes = await database.prepare("SELECT id,code_hash,attempts FROM navixa_user_login_codes WHERE email_hash=? AND purpose='login' AND consumed_at='' AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(emailHash, now).all<{ id: string; code_hash: string; attempts: number }>();
  const activeCode = codes.results[0];
  if (!activeCode || activeCode.attempts >= 5 || activeCode.code_hash !== expected) {
    if (activeCode) await database.prepare("UPDATE navixa_user_login_codes SET attempts=attempts+1 WHERE id=?").bind(activeCode.id).run();
    return NextResponse.json({ error: "الرمز غير صحيح أو انتهت صلاحيته" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  await database.prepare("UPDATE navixa_user_login_codes SET consumed_at=? WHERE id=? AND consumed_at=''").bind(now, activeCode.id).run();
  const existing = await database.prepare("SELECT id,status FROM navixa_users WHERE email_hash=? LIMIT 1").bind(emailHash).all<{ id: string; status: "pending" | "active" | "suspended" }>();
  let userId = existing.results[0]?.id || crypto.randomUUID();
  if (existing.results[0]?.status === "suspended") return NextResponse.json({ error: "هذا الحساب موقوف. تواصل مع دعم NAVIXA." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  if (!existing.results[0]) await database.prepare("INSERT INTO navixa_users(id,email,email_hash,webauthn_user_id,status,created_at,updated_at,last_login_at) VALUES (?,?,?,?, 'active',?,?,?)").bind(userId, email, emailHash, createOpaqueToken(), now, now, now).run();
  else await database.prepare("UPDATE navixa_users SET status='active',updated_at=?,last_login_at=? WHERE id=?").bind(now, now, userId).run();
  if (settings.earlyAccessEnabled) {
    const subscriber = await database.prepare("SELECT id,status FROM navixa_subscribers WHERE user_id=? OR contact=? LIMIT 1").bind(userId, email).all<{ id: string; status: string }>();
    if (!subscriber.results[0]) {
      // نهاية الحملة: 19 سبتمبر 2026، 23:59:59 بتوقيت أم القرى (UTC+3).
      const campaignEnd = Date.parse("2026-09-19T20:59:59.999Z");
      const requestedEnd = Date.now() + settings.trialDays * 86_400_000;
      if (Date.now() >= campaignEnd) return NextResponse.json({ error: "انتهت فترة التجربة المجانية حاليًا. يمكنك الاشتراك في Plus عند توفر الباقة." }, { status: 403, headers: { "Cache-Control": "no-store" } });
      const trialEnd = new Date(Math.min(requestedEnd, campaignEnd)).toISOString();
      await database.prepare("INSERT INTO navixa_subscribers(id,user_id,contact,display_name,plan,status,trial_started_at,trial_ends_at,source,created_at,updated_at) VALUES (?,?,?,'','trial','trial',?,?, 'early_access_account',?,?)").bind(crypto.randomUUID(), userId, email, now, trialEnd, now, now).run();
    } else if (subscriber.results[0].status !== "active") {
      await database.prepare("UPDATE navixa_subscribers SET user_id=?,updated_at=? WHERE id=?").bind(userId, now, subscriber.results[0].id).run();
    }
  }
  const session = await createUserSession(database, userId);
  return NextResponse.json({ ok: true, user: { email }, passkeysAvailable: settings.passkeysEnabled }, { headers: { "Set-Cookie": makeUserSessionCookie(session.token), "Cache-Control": "no-store" } });
}
