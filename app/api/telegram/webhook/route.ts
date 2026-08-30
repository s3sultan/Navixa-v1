import { NextResponse } from "next/server.js";
import { getUserAuthSettings, hashOpaqueValue, type D1Database } from "../../../../worker/userAuth.ts";
import { encryptTelegramIdentifier, hashTelegramValue, sendOfficialTelegramMessage, telegramRuntimeEnv, validTelegramChatId, validTelegramLinkToken } from "../../../../worker/telegramBot.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type TelegramUpdate = { message?: { text?: string; chat?: { id?: number | string }; from?: { id?: number | string } } };

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
function reply(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

export async function POST(request: Request) {
  const runtime = await telegramRuntimeEnv();
  const providedSecret = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!runtime.NAVIXA_TELEGRAM_WEBHOOK_SECRET || providedSecret !== runtime.NAVIXA_TELEGRAM_WEBHOOK_SECRET) return reply({ ok: false }, 401);
  const database = await db();
  if (!database || !runtime.NAVIXA_TELEGRAM_BOT_TOKEN || !runtime.NAVIXA_TELEGRAM_ENCRYPTION_KEY) return reply({ ok: true });
  const settings = await getUserAuthSettings(database).catch(() => null);
  if (!settings?.telegramBotEnabled) return reply({ ok: true });

  const update = await request.json().catch(() => ({})) as TelegramUpdate;
  const message = update.message;
  const text = message?.text?.trim() || "";
  const match = text.match(/^\/start(?:\s+([A-Za-z0-9_-]{32,64}))?$/);
  const chatId = String(message?.chat?.id || "");
  const telegramUserId = String(message?.from?.id || "");
  if (validTelegramChatId(chatId) && !match?.[1] && /^\/(start|help|settings|stop|activate|link)(?:@\w+)?$/i.test(text)) {
    const command = text.replace(/^\//, "").split("@")[0].toLowerCase();
    const answers: Record<string, string> = {
      start: "أهلًا بك في NAVIXA SA. /start العادي لا يربط الحساب. افتح حسابك في NAVIXA واضغط «ربط Telegram». إذا لم يظهر زر START في Telegram Web، الصق أمر الربط الذي نسخه NAVIXA تلقائيًا ثم أرسله.",
      help: "المساعدة: الربط الحقيقي يبدأ من حسابك في NAVIXA عبر «ربط Telegram». افتح الرابط واضغط START. إذا لم يظهر START في Telegram Web، الصق أمر الربط المنسوخ تلقائيًا. لا تحتاج Token أو Chat ID.",
      activate: "طريقة التفعيل: 1) سجّل دخولك إلى NAVIXA بالبريد. 2) افتح الحساب. 3) اضغط ربط Telegram. 4) في Telegram اضغط START. إذا لم يظهر START، الصق أمر الربط الذي نسخه NAVIXA تلقائيًا. 5) ارجع واختر التنبيهات التي تريدها.",
      link: "الربط يبدأ من زر «ربط Telegram» داخل حساب NAVIXA. /start العادي لا يربط الحساب. إذا لم يظهر START بعد فتح الرابط، الصق أمر الربط الذي نسخه NAVIXA تلقائيًا.",
      settings: "إعدادات التنبيهات تُدار من حسابك في NAVIXA لضمان خصوصيتك. اكتب /activate لخطوات الربط، ثم شغّل أو أوقف كل نوع تنبيه بعد الربط.",
      stop: "لن تصلك تنبيهات جديدة عند إيقافها من إعدادات Telegram داخل حساب NAVIXA. يمكنك الرجوع إليها في أي وقت.",
    };
    await sendOfficialTelegramMessage({ chatId, token: runtime.NAVIXA_TELEGRAM_BOT_TOKEN, text: answers[command] || answers.help });
    return reply({ ok: true });
  }
  if (!match?.[1] || !validTelegramLinkToken(match[1]) || !validTelegramChatId(chatId) || !validTelegramChatId(telegramUserId)) return reply({ ok: true });

  const now = new Date();
  const tokenHash = await hashOpaqueValue(match[1]);
  const tokenRows = await database.prepare("SELECT id,user_id FROM navixa_user_telegram_link_tokens WHERE token_hash=? AND consumed_at='' AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(tokenHash, now.toISOString()).all<{ id: string; user_id: string }>();
  const token = tokenRows.results[0];
  if (!token) {
    await sendOfficialTelegramMessage({ chatId, token: runtime.NAVIXA_TELEGRAM_BOT_TOKEN, text: "انتهت صلاحية رابط الربط أو تم استخدامه. ارجع إلى NAVIXA وأنشئ رابطًا جديدًا." });
    return reply({ ok: true });
  }

  const telegramUserHash = await hashTelegramValue(telegramUserId, runtime.NAVIXA_TELEGRAM_ENCRYPTION_KEY);
  const existing = await database.prepare("SELECT user_id FROM navixa_user_telegram_links WHERE telegram_user_hash=? AND revoked_at='' LIMIT 1").bind(telegramUserHash).all<{ user_id: string }>();
  if (existing.results[0] && existing.results[0].user_id !== token.user_id) {
    await database.prepare("UPDATE navixa_user_telegram_link_tokens SET consumed_at=? WHERE id=?").bind(now.toISOString(), token.id).run();
    await sendOfficialTelegramMessage({ chatId, token: runtime.NAVIXA_TELEGRAM_BOT_TOKEN, text: "حساب Telegram هذا مرتبط بالفعل بحساب NAVIXA آخر. افصل الربط من الحساب الحالي أولًا." });
    return reply({ ok: true });
  }

  const chatIdCiphertext = await encryptTelegramIdentifier(chatId, runtime.NAVIXA_TELEGRAM_ENCRYPTION_KEY);
  await database.prepare("INSERT INTO navixa_user_telegram_links(user_id,telegram_user_hash,chat_id_ciphertext,linked_at,updated_at,revoked_at) VALUES(?,?,?,?,?, '') ON CONFLICT(user_id) DO UPDATE SET telegram_user_hash=excluded.telegram_user_hash,chat_id_ciphertext=excluded.chat_id_ciphertext,updated_at=excluded.updated_at,revoked_at='' ").bind(token.user_id, telegramUserHash, chatIdCiphertext, now.toISOString(), now.toISOString()).run();
  await database.prepare("UPDATE navixa_user_telegram_link_tokens SET consumed_at=? WHERE id=?").bind(now.toISOString(), token.id).run();
  await sendOfficialTelegramMessage({ chatId, token: runtime.NAVIXA_TELEGRAM_BOT_TOKEN, text: "تم ربط Telegram بحسابك في NAVIXA بنجاح. ستصل إليك فقط التنبيهات التي تختارها." });
  return reply({ ok: true });
}
