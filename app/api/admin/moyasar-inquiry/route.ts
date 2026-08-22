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

const subject = "استفسارات رسوم وتشغيل بوابة الدفع — NAVIXA SA";
const text = `السلام عليكم فريق مُيسر،

نحن NAVIXA SA ونراجع عرض الرسوم المقدم بتاريخ 22 أغسطس 2026 قبل إتمام تفعيل الحساب وإطلاق الاشتراكات.

نرجو التكرم بتأكيد النقاط التالية كتابةً:

1) هل رسم إدارة المخاطر (1 ر.س) يطبق على كل عملية ناجحة، بما فيها مدى وApple Pay والتجديدات الدورية؟
2) هل الرسوم الواردة في العرض تشمل ضريبة القيمة المضافة أم تضاف عليها؟
3) هل رسم Tokenization (0.05 ر.س) يطبق على كل عملية أم فقط عند حفظ البطاقة أو التجديد؟
4) عند استرداد مبلغ، هل تؤخذ رسوم الاسترداد فقط أم تبقى رسوم العملية الأصلية أيضًا؟
5) هل يمكن إعفاء أو تخفيض رسم تفعيل Apple Pay (250 ر.س) أو رسوم التأسيس (450 ر.س) مع إطلاق البطاقات ومدى وApple Pay معًا؟
6) نرجو تزويدنا برسوم وشروط STC Pay وAmerican Express، ومدة التسوية وشروط التحويل اليومي.

نقدّر تعاونكم، ونرجو إرسال الرد إلى البريد المحدد للرد على هذه الرسالة.

مع التحية،
فريق NAVIXA SA
navixasa.com`;

export async function POST(request: Request) {
  if (!await allowed(request)) return noStore({ error: "غير مصرح" }, 401);
  const client = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "admin";
  const quota = limiter.consume(`navixa-admin-moyasar-inquiry:${client}`, 1, 24 * 60 * 60_000);
  if (!quota.allowed) return noStore({ error: "أُرسل استفسار مُيسر من هذا المدير خلال آخر 24 ساعة.", retryAfterSeconds: quota.retryAfterSeconds }, 429);

  const env = await runtimeEnv();
  const from = env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM;
  const replyTo = env.NAVIXA_ADMIN_EMAIL;
  if (!env.RESEND_API_KEY || !from || !replyTo) return noStore({ error: "إعداد بريد NAVIXA غير مكتمل" }, 409);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: ["info@moyasar.com"], reply_to: replyTo, subject, text }),
    });
    if (!response.ok) return noStore({ error: "تعذر إرسال استفسار مُيسر عبر Resend" }, 502);
    return noStore({ ok: true, message: "تم إرسال استفسار الرسوم الرسمي إلى فريق مُيسر" });
  } catch {
    return noStore({ error: "تعذر الاتصال بخدمة البريد الآن" }, 502);
  }
}
