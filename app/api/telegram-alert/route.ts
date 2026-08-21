import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter } from "../../../worker/adminAuth.ts";
import { getUserAuthSettings, resolveUserSession, trustedUserMutation, type D1Database } from "../../../worker/userAuth.ts";
import { decryptTelegramIdentifier, sendOfficialTelegramMessage, telegramRuntimeEnv } from "../../../worker/telegramBot.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
const telegramLimiter = createMemoryRateLimiter();
const alertTypes = new Set(["adhan","iqama","water","break","focus","name","wird","sadaqah","task"]);

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
function clientKey(request: Request) { return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }
function noStore(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return noStore({ error: "مصدر الطلب غير موثوق" }, 403);
  const limit = telegramLimiter.consume(clientKey(request), 5, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "تجاوزت الحد المؤقت للطلبات", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.max(1, limit.retryAfterSeconds)) } });
  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
    const notificationType = typeof body.type === "string" && alertTypes.has(body.type) ? body.type : null;
    if (!text) return noStore({ error: "رسالة غير صالحة" }, 400);
    const database = await db();
    if (!database) return noStore({ error: "Telegram غير مهيأ الآن" }, 503);
    const [settings, session, runtime] = await Promise.all([getUserAuthSettings(database).catch(() => null), resolveUserSession(request, database), telegramRuntimeEnv()]);
    if (!settings?.userAuthEnabled || !settings.telegramBotEnabled) return noStore({ error: "بوت NAVIXA غير مفعّل" }, 404);
    if (!session) return noStore({ error: "سجّل الدخول أولًا لربط Telegram" }, 401);
    if (!runtime.NAVIXA_TELEGRAM_BOT_TOKEN || !runtime.NAVIXA_TELEGRAM_ENCRYPTION_KEY) return noStore({ error: "بوت NAVIXA غير مهيأ بعد" }, 503);
    const link = await database.prepare("SELECT chat_id_ciphertext FROM navixa_user_telegram_links WHERE user_id=? AND revoked_at='' LIMIT 1").bind(session.userId).all<{ chat_id_ciphertext: string }>();
    const linked = link.results[0];
    if (!linked) return noStore({ error: "اربط Telegram بحسابك أولًا" }, 409);
    if (notificationType) {
      const preference = await database.prepare("SELECT enabled FROM navixa_user_telegram_preferences WHERE user_id=? AND notification_type=? LIMIT 1").bind(session.userId, notificationType).all<{ enabled: number }>();
      if (preference.results[0]?.enabled === 0) return noStore({ ok: true, skipped: true });
    }
    const chatId = await decryptTelegramIdentifier(linked.chat_id_ciphertext, runtime.NAVIXA_TELEGRAM_ENCRYPTION_KEY);
    const sent = await sendOfficialTelegramMessage({ chatId, token: runtime.NAVIXA_TELEGRAM_BOT_TOKEN, text });
    if (!sent) return noStore({ error: "تعذر إرسال التنبيه" }, 502);
    return noStore({ ok: true });
  } catch {
    return noStore({ error: "تعذر معالجة التنبيه" }, 500);
  }
}
