import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

type Env = Record<string, string | undefined>;
type TelegramWebhookInfo = { ok?: boolean; result?: { url?: string; pending_update_count?: number; last_error_date?: number; last_error_message?: string; max_connections?: number; allowed_updates?: string[] } };

async function runtimeEnv(): Promise<Env> {
  try { return (await import("cloudflare:workers") as { env?: Env }).env || {}; }
  catch { return globalThis as Env; }
}

export async function GET(request: Request) {
  const secret = await resolveAdminJwtSecret();
  if (!secret || !await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const token = (await runtimeEnv()).NAVIXA_TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ configured: false, error: "توكن Telegram غير مهيأ" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as TelegramWebhookInfo;
    if (!response.ok || !payload.ok) return NextResponse.json({ error: "تعذر قراءة حالة Webhook من Telegram" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    const info = payload.result || {};
    return NextResponse.json({
      configured: Boolean(info.url),
      url: info.url || "",
      pendingUpdates: info.pending_update_count || 0,
      lastErrorAt: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : "",
      lastError: info.last_error_message || "",
      maxConnections: info.max_connections || 0,
      allowedUpdates: info.allowed_updates || [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "تعذر الاتصال بـTelegram" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
