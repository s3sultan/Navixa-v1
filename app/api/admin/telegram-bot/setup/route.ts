import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../../worker/adminAuth.ts";
import { officialTelegramBotUsername } from "../../../../../worker/telegramBot.ts";

type Env = Record<string, string | undefined>;
type TelegramResponse = { ok?: boolean; result?: { username?: string }; description?: string };
const OFFICIAL_TELEGRAM_WEBHOOK_URL = "https://navixasa.com/api/telegram/webhook";

async function runtimeEnv(): Promise<Env> {
  try { return (await import("cloudflare:workers") as { env?: Env }).env || {}; }
  catch { return globalThis as Env; }
}

async function allowed(request: Request) {
  const secret = await resolveAdminJwtSecret();
  return Boolean(secret && isTrustedSameOriginRequest(request) && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret));
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await allowed(request)) return noStore({ error: "غير مصرح" }, 401);
  const env = await runtimeEnv();
  const token = env.NAVIXA_TELEGRAM_BOT_TOKEN;
  const username = officialTelegramBotUsername(env.NAVIXA_TELEGRAM_BOT_USERNAME);
  const webhookSecret = env.NAVIXA_TELEGRAM_WEBHOOK_SECRET;
  if (!token || !webhookSecret) return noStore({ error: "أضف أسرار بوت NAVIXA الرسمية أولًا" }, 409);

  try {
    const meResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store" });
    const me = await meResponse.json().catch(() => ({})) as TelegramResponse;
    if (!meResponse.ok || !me.ok) return noStore({ error: "تعذر التحقق من توكن بوت Telegram" }, 502);
    if (me.result?.username?.toLowerCase() !== username.toLowerCase()) return noStore({ error: "اسم البوت لا يطابق التوكن المضاف" }, 409);

    const webhookUrl = OFFICIAL_TELEGRAM_WEBHOOK_URL;
    const webhookResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, secret_token: webhookSecret, allowed_updates: ["message"], drop_pending_updates: false }),
    });
    const webhook = await webhookResponse.json().catch(() => ({})) as TelegramResponse;
    if (!webhookResponse.ok || !webhook.ok) return noStore({ error: "تعذر إعداد Webhook للبوت" }, 502);
    const commandsResponse = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands: [
        { command: "start", description: "بدء وربط تنبيهات NAVIXA" },
        { command: "activate", description: "شرح تفعيل وربط التنبيهات" },
        { command: "link", description: "طريقة ربط حساب NAVIXA" },
        { command: "settings", description: "إعدادات التنبيهات" },
        { command: "stop", description: "إيقاف تنبيهات هذا الحساب" },
        { command: "help", description: "المساعدة" },
      ] }),
    });
    const commands = await commandsResponse.json().catch(() => ({})) as TelegramResponse;
    if (!commandsResponse.ok || !commands.ok) return noStore({ error: "تم إعداد Webhook لكن تعذر تحديث قائمة أوامر البوت" }, 502);
    return noStore({ ok: true, message: "تم التحقق من البوت وربط Webhook وتحديث قائمة الأوامر", webhookUrl, username: me.result?.username || username });
  } catch {
    return noStore({ error: "تعذر الاتصال بـTelegram الآن، حاول مرة أخرى" }, 502);
  }
}
