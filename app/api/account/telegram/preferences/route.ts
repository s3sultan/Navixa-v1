import { NextResponse } from "next/server.js";
import { getUserAuthSettings, resolveUserSession, trustedUserMutation, type D1Database } from "../../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
const alertTypes = new Set(["adhan","iqama","water","break","focus","name","wird","sadaqah","task","renewal","emergency"]);
async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
function reply(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

export async function GET(request: Request) {
  const database = await db();
  if (!database) return reply({ enabled: false }, 503);
  const session = await resolveUserSession(request, database);
  if (!session) return reply({ enabled: false }, 401);
  const preference = await database.prepare("SELECT enabled FROM navixa_user_telegram_preferences WHERE user_id=? AND notification_type='renewal' LIMIT 1").bind(session.userId).all<{ enabled: number }>();
  return reply({ enabled: preference.results[0]?.enabled === 1 });
}

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return reply({ error: "مصدر الطلب غير موثوق" }, 403);
  const database = await db();
  if (!database) return reply({ error: "التخزين غير مهيأ" }, 503);
  const [settings, session] = await Promise.all([getUserAuthSettings(database).catch(() => null), resolveUserSession(request, database)]);
  if (!settings?.userAuthEnabled || !settings.telegramBotEnabled) return reply({ error: "بوت NAVIXA غير مفعّل" }, 404);
  if (!session) return reply({ error: "سجّل الدخول أولًا" }, 401);
  const body = await request.json().catch(() => ({})) as { type?: unknown; enabled?: unknown };
  if (typeof body.type !== "string" || !alertTypes.has(body.type) || typeof body.enabled !== "boolean") return reply({ error: "تفضيل تنبيه غير صالح" }, 400);
  const linked = await database.prepare("SELECT user_id FROM navixa_user_telegram_links WHERE user_id=? AND revoked_at='' LIMIT 1").bind(session.userId).all<{ user_id: string }>();
  if (!linked.results[0]) return reply({ error: "اربط Telegram بحسابك أولًا" }, 409);
  await database.prepare("INSERT INTO navixa_user_telegram_preferences(user_id,notification_type,enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,notification_type) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at").bind(session.userId, body.type, body.enabled ? 1 : 0, new Date().toISOString()).run();
  return reply({ ok: true });
}
