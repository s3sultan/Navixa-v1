import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, createMemoryRateLimiter, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";
import { sendOfficialTelegramMessage } from "../../../../worker/telegramBot.ts";

type Env = Record<string, string | undefined>;
const limiter = createMemoryRateLimiter();

async function runtimeEnv(): Promise<Env> {
  try { return (await import("cloudflare:workers") as { env?: Env }).env || {}; }
  catch { return globalThis as Env; }
}
async function allowed(request: Request) {
  const secret = await resolveAdminJwtSecret();
  return Boolean(secret && isTrustedSameOriginRequest(request) && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret));
}
function noStore(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

export async function POST(request: Request) {
  if (!await allowed(request)) return noStore({ error: "غير مصرح" }, 401);
  const client = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "admin";
  const quota = limiter.consume(`navixa-admin-telegram-test:${client}`, 2, 10 * 60_000);
  if (!quota.allowed) return noStore({ error: "تم تجاوز حد اختبارات Telegram المؤقت. حاول بعد قليل.", retryAfterSeconds: quota.retryAfterSeconds }, 429);
  const env = await runtimeEnv();
  if (!env.NAVIXA_TELEGRAM_BOT_TOKEN || !env.NAVIXA_ADMIN_TELEGRAM_CHAT_ID) return noStore({ error: "Telegram الإداري غير مكتمل الإعداد" }, 409);
  try {
    const ok = await sendOfficialTelegramMessage({ chatId: env.NAVIXA_ADMIN_TELEGRAM_CHAT_ID, token: env.NAVIXA_TELEGRAM_BOT_TOKEN, text: "اختبار تنبيهات NAVIXA SA\n\nالبوت والإرسال الإداري يعملان. لا يلزم اتخاذ أي إجراء." });
    return ok ? noStore({ ok: true, message: "تم إرسال اختبار Telegram إلى المدير" }) : noStore({ error: "رفض Telegram رسالة الاختبار" }, 502);
  } catch { return noStore({ error: "تعذر الاتصال بـ Telegram الآن" }, 502); }
}
