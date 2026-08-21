import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter } from "../../../../../worker/adminAuth.ts";
import { createOpaqueToken, getUserAuthSettings, hashOpaqueValue, resolveUserSession, trustedUserMutation, type D1Database } from "../../../../../worker/userAuth.ts";
import { telegramRuntimeEnv } from "../../../../../worker/telegramBot.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
const limiter = createMemoryRateLimiter();

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
function noStore(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function clientKey(request: Request) { return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }

export async function GET(request: Request) {
  const database = await db();
  if (!database) return noStore({ configured: false }, 503);
  const [settings, session] = await Promise.all([getUserAuthSettings(database).catch(() => null), resolveUserSession(request, database)]);
  if (!settings?.userAuthEnabled || !settings.telegramBotEnabled) return noStore({ enabled: false }, 404);
  if (!session) return noStore({ error: "سجّل الدخول أولًا" }, 401);
  const row = await database.prepare("SELECT linked_at,updated_at FROM navixa_user_telegram_links WHERE user_id=? AND revoked_at='' LIMIT 1").bind(session.userId).all<{ linked_at: string; updated_at: string }>();
  return noStore({ enabled: true, linked: Boolean(row.results[0]), linkedAt: row.results[0]?.linked_at || null, updatedAt: row.results[0]?.updated_at || null });
}

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return noStore({ error: "مصدر الطلب غير موثوق" }, 403);
  const limit = limiter.consume(clientKey(request), 5, 10 * 60_000);
  if (!limit.allowed) return noStore({ error: "تجاوزت حد طلبات الربط المؤقت", retryAfterSeconds: limit.retryAfterSeconds }, 429);
  const database = await db();
  if (!database) return noStore({ configured: false }, 503);
  const [settings, session, runtime] = await Promise.all([getUserAuthSettings(database).catch(() => null), resolveUserSession(request, database), telegramRuntimeEnv()]);
  if (!settings?.userAuthEnabled || !settings.telegramBotEnabled) return noStore({ error: "ربط Telegram غير مفعّل" }, 404);
  if (!session) return noStore({ error: "سجّل الدخول أولًا" }, 401);
  if (!runtime.NAVIXA_TELEGRAM_BOT_TOKEN || !runtime.NAVIXA_TELEGRAM_WEBHOOK_SECRET || !runtime.NAVIXA_TELEGRAM_ENCRYPTION_KEY || !runtime.NAVIXA_TELEGRAM_BOT_USERNAME) return noStore({ error: "بوت NAVIXA غير مهيأ بعد" }, 503);
  const token = createOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
  await database.prepare("UPDATE navixa_user_telegram_link_tokens SET consumed_at=? WHERE user_id=? AND consumed_at='' ").bind(now.toISOString(), session.userId).run();
  await database.prepare("INSERT INTO navixa_user_telegram_link_tokens(id,user_id,token_hash,created_at,expires_at,consumed_at) VALUES(?,?,?,?,?, '')").bind(crypto.randomUUID(), session.userId, await hashOpaqueValue(token), now.toISOString(), expiresAt).run();
  return noStore({ ok: true, expiresAt, link: `https://t.me/${runtime.NAVIXA_TELEGRAM_BOT_USERNAME}?start=${token}` });
}

export async function DELETE(request: Request) {
  if (!trustedUserMutation(request)) return noStore({ error: "مصدر الطلب غير موثوق" }, 403);
  const database = await db();
  if (!database) return noStore({ configured: false }, 503);
  const session = await resolveUserSession(request, database);
  if (!session) return noStore({ error: "سجّل الدخول أولًا" }, 401);
  const now = new Date().toISOString();
  await Promise.all([
    database.prepare("UPDATE navixa_user_telegram_links SET revoked_at=?,updated_at=? WHERE user_id=? AND revoked_at='' ").bind(now, now, session.userId).run(),
    database.prepare("UPDATE navixa_user_telegram_link_tokens SET consumed_at=? WHERE user_id=? AND consumed_at='' ").bind(now, session.userId).run(),
  ]);
  return noStore({ ok: true });
}
