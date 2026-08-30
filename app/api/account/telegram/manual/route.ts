import { NextResponse } from "next/server.js";
import { resolveUserSession, trustedUserMutation, type D1Database } from "../../../../../worker/userAuth.ts";
import { encryptTelegramIdentifier, telegramRuntimeEnv, validTelegramChatId } from "../../../../../worker/telegramBot.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type TelegramMe = { ok?: boolean; result?: { username?: string }; description?: string };

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
function noStore(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function validBotToken(value: unknown): value is string { return typeof value === "string" && /^\d{5,15}:[A-Za-z0-9_-]{20,90}$/.test(value.trim()); }

export async function GET(request: Request) {
  const database = await db();
  if (!database) return noStore({ error: "التخزين غير مهيأ" }, 503);
  const session = await resolveUserSession(request, database);
  if (!session) return noStore({ error: "سجّل الدخول أولًا" }, 401);
  const row = await database.prepare("SELECT bot_username,linked_at,updated_at FROM navixa_user_telegram_manual WHERE user_id=? AND revoked_at='' LIMIT 1").bind(session.userId).all<{ bot_username: string; linked_at: string; updated_at: string }>().catch(() => ({ results: [] }));
  return noStore({ linked: Boolean(row.results[0]), botUsername: row.results[0]?.bot_username || "", linkedAt: row.results[0]?.linked_at || null, updatedAt: row.results[0]?.updated_at || null });
}

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return noStore({ error: "مصدر الطلب غير موثوق" }, 403);
  const database = await db();
  if (!database) return noStore({ error: "التخزين غير مهيأ" }, 503);
  const [session, runtime] = await Promise.all([resolveUserSession(request, database), telegramRuntimeEnv()]);
  if (!session) return noStore({ error: "سجّل الدخول أولًا" }, 401);
  if (!runtime.NAVIXA_TELEGRAM_ENCRYPTION_KEY) return noStore({ error: "تشفير Telegram غير مهيأ" }, 503);
  const body = await request.json().catch(() => ({})) as { botToken?: unknown; chatId?: unknown };
  const botToken = typeof body.botToken === "string" ? body.botToken.trim() : "";
  const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
  if (!validBotToken(botToken) || !validTelegramChatId(chatId)) return noStore({ error: "تحقق من Bot Token وChat ID" }, 400);

  try {
    const meResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { cache: "no-store" });
    const me = await meResponse.json().catch(() => ({})) as TelegramMe;
    if (!meResponse.ok || !me.ok) return noStore({ error: "Bot Token غير صالح أو رفضه Telegram" }, 400);
    const testResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "تم ربط بوت Telegram الشخصي مع NAVIXA بنجاح ✅\nيمكنك الآن استقبال التنبيهات عبر هذا البوت.", disable_web_page_preview: true }),
    });
    if (!testResponse.ok) return noStore({ error: "التوكن صحيح لكن Chat ID لم يقبل رسالة الاختبار" }, 400);

    const now = new Date().toISOString();
    const [tokenCiphertext, chatCiphertext] = await Promise.all([
      encryptTelegramIdentifier(botToken, runtime.NAVIXA_TELEGRAM_ENCRYPTION_KEY),
      encryptTelegramIdentifier(chatId, runtime.NAVIXA_TELEGRAM_ENCRYPTION_KEY),
    ]);
    await database.prepare("INSERT INTO navixa_user_telegram_manual(user_id,bot_token_ciphertext,chat_id_ciphertext,bot_username,linked_at,updated_at,revoked_at) VALUES(?,?,?,?,?,?, '') ON CONFLICT(user_id) DO UPDATE SET bot_token_ciphertext=excluded.bot_token_ciphertext,chat_id_ciphertext=excluded.chat_id_ciphertext,bot_username=excluded.bot_username,updated_at=excluded.updated_at,revoked_at='' ").bind(session.userId, tokenCiphertext, chatCiphertext, me.result?.username || "", now, now).run();
    return noStore({ ok: true, linked: true, botUsername: me.result?.username || "", message: "تم التحقق من البوت وإرسال رسالة اختبار وحفظه مشفرًا" });
  } catch {
    return noStore({ error: "تعذر الاتصال بـ Telegram الآن" }, 502);
  }
}

export async function DELETE(request: Request) {
  if (!trustedUserMutation(request)) return noStore({ error: "مصدر الطلب غير موثوق" }, 403);
  const database = await db();
  if (!database) return noStore({ error: "التخزين غير مهيأ" }, 503);
  const session = await resolveUserSession(request, database);
  if (!session) return noStore({ error: "سجّل الدخول أولًا" }, 401);
  const now = new Date().toISOString();
  await database.prepare("UPDATE navixa_user_telegram_manual SET revoked_at=?,updated_at=? WHERE user_id=? AND revoked_at='' ").bind(now, now, session.userId).run().catch(() => {});
  return noStore({ ok: true });
}
