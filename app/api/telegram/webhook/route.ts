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
  if (!runtime.NAVIXA_TELEGRAM_WEBHOOK_SECRET) return reply({ ok: false, reason: "webhook_secret_unavailable" }, 503);
  if (providedSecret !== runtime.NAVIXA_TELEGRAM_WEBHOOK_SECRET) return reply({ ok: false, reason: "webhook_secret_mismatch" }, 401);
  const database = await db();
  if (!database) return reply({ ok: false, reason: "database_unavailable" }, 503);
  if (!runtime.NAVIXA_TELEGRAM_BOT_TOKEN || !runtime.NAVIXA_TELEGRAM_ENCRYPTION_KEY) return reply({ ok: false, reason: "telegram_runtime_incomplete" }, 503);
  const settings = await getUserAuthSettings(database).catch(() => null);
  if (!settings?.telegramBotEnabled) return reply({ ok: true, ignored: "telegram_disabled" });

  const update = await request.json().catch(() => ({})) as TelegramUpdate;
  const message = update.message;
  const text = message?.text?.trim() || "";
  const match = text.match(/^\/(start|activate|link)(?:@\w+)?(?:\s+([A-Za-z0-9_-]{32,64}))?$/i);
  const tokenValue = match?.[2] || "";
  const chatId = String(message?.chat?.id || "");
  const telegramUserId = String(message?.from?.id || "");

  if (validTelegramChatId(chatId) && !tokenValue && /^\/(start|help|settings|stop|activate|link)(?:@\w+)?$/i.test(text)) {
    const command = text.replace(/^\//, "").split("@")[0].toLowerCase();
    const answers: Record<string, string> = {
      start: "أهلًا بك في NAVIXA SA. الربط الآمن يبدأ من حسابك في NAVIXA: اضغط «ربط Telegram» ثم أكّد START هنا مرة واحدة فقط.",
      help: "للربط: افتح حسابك في NAVIXA واضغط «ربط Telegram». إذا لم يظهر START بعد فتح Telegram، الصق أمر /activate الذي نسخه NAVIXA تلقائيًا ثم أرسله. لا تحتاج Token أو Chat ID يدويًا.",
      activate: "افتح حسابك في NAVIXA واضغط «ربط Telegram». سيُفتح Telegram برابط آمن. اضغط START مرة واحدة. إذا لم يظهر START، الصق أمر /activate الذي نسخه NAVIXA تلقائيًا.",
      link: "الربط يبدأ من زر «ربط Telegram» داخل حساب NAVIXA. بعدها أكّد START مرة واحدة فقط. إذا لم يظهر، الصق أمر /activate المنسوخ تلقائيًا.",
      settings: "إعدادات التنبيهات تُدار من حسابك في NAVIXA لضمان خصوصيتك. بعد الربط اختر التنبيهات التي تريدها.",
      stop: "لن تصلك تنبيهات جديدة عند إيقافها من إعدادات Telegram داخل حساب NAVIXA. يمكنك الرجوع إليها في أي وقت.",
    };
    await sendOfficialTelegramMessage({ chatId, token: runtime.NAVIXA_TELEGRAM_BOT_TOKEN, text: answers[command] || answers.help });
    return reply({ ok: true });
  }

  if (!validTelegramLinkToken(tokenValue) || !validTelegramChatId(chatId) || !validTelegramChatId(telegramUserId)) return reply({ ok: true });

  const now = new Date();
  const tokenHash = await hashOpaqueValue(tokenValue);
  const tokenRows = await database.prepare("SELECT id,user_id FROM navixa_user_telegram_link_tokens WHERE token_hash=? AND consumed_at='' AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(tokenHash, now.toISOString()).all<{ id: string; user_id: string }>();
  const token = tokenRows.results[0];
  if (!token) {
    await sendOfficialTelegramMessage({ chatId, token: runtime.NAVIXA_TELEGRAM_BOT_TOKEN, text: "انتهت صلاحية رابط الربط أو تم استخدامه. ارجع إلى NAVIXA واضغط «ربط Telegram» مرة أخرى." });
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
  await sendOfficialTelegramMessage({ chatId, token: runtime.NAVIXA_TELEGRAM_BOT_TOKEN, text: "تم ربط Telegram بحسابك في NAVIXA بنجاح ✅ الربط تم لمرة واحدة، ويمكنك الآن اختيار التنبيهات التي تريدها." });
  return reply({ ok: true });
}
