import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, createMemoryRateLimiter, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

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

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await allowed(request)) return noStore({ error: "غير مصرح" }, 401);
  const client = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "admin";
  const quota = limiter.consume(`navixa-admin-email-test:${client}`, 3, 10 * 60_000);
  if (!quota.allowed) return noStore({ error: "تم تجاوز حد اختبارات البريد المؤقت. حاول بعد قليل.", retryAfterSeconds: quota.retryAfterSeconds }, 429);

  const env = await runtimeEnv();
  const from = env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM;
  const to = env.NAVIXA_ADMIN_EMAIL;
  if (!env.RESEND_API_KEY || !from || !to) return noStore({ error: "بريد NAVIXA غير مكتمل الإعداد" }, 409);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "اختبار بريد NAVIXA SA",
        text: "هذه رسالة اختبار إدارية من NAVIXA SA للتأكد من جاهزية الإرسال. لا يلزم اتخاذ أي إجراء.",
      }),
    });
    if (!response.ok) return noStore({ error: "تعذر إرسال اختبار البريد عبر Resend" }, 502);
    return noStore({ ok: true, message: "تم إرسال رسالة الاختبار إلى بريد المدير" });
  } catch {
    return noStore({ error: "تعذر الاتصال بخدمة البريد الآن" }, 502);
  }
}
