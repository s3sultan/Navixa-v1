import { NextResponse } from "next/server.js";
import {
  ADMIN_SESSION_COOKIE,
  createMemoryRateLimiter,
  isTrustedSameOriginRequest,
  readCookie,
  resolveAdminJwtSecret,
  verifyAdminSessionToken,
} from "../../../../worker/adminAuth.ts";

type Env = Record<string, string | undefined>;
type Provider = "moyasar" | "paytabs";

const limiter = createMemoryRateLimiter();

async function runtimeEnv(): Promise<Env> {
  try {
    return (await import("cloudflare:workers") as { env?: Env }).env || {};
  } catch {
    return globalThis as Env;
  }
}

async function allowed(request: Request) {
  const secret = await resolveAdminJwtSecret();
  return Boolean(
    secret
      && isTrustedSameOriginRequest(request)
      && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret),
  );
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const inquiries: Record<Provider, { to: string; subject: string; text: string; successMessage: string }> = {
  moyasar: {
    to: "info@moyasar.com",
    subject: "طلب عرض اليوم الوطني 2026 لمنصة NAVIXA SA",
    successMessage: "تم إرسال طلب عرض اليوم الوطني إلى فريق مُيسر",
    text: `السلام عليكم ورحمة الله وبركاته،

فريق مُيسر المحترم،

نحن فريق NAVIXA SA، منصة سعودية باشتراكات رقمية، ونستعد لإطلاق مرحلة Plus خلال موسم اليوم الوطني السعودي 2026.

نشكر لكم العرض المرسل سابقًا. وقبل استكمال التفعيل، نرغب في معرفة ما إذا كانت لديكم عروض أو حوافز تجارية مخصصة لليوم الوطني تشمل منشآت رقمية ناشئة، وخصوصًا أحد الخيارات التالية:

- إعفاء أو تخفيض رسوم التأسيس.
- إعفاء أو تخفيض رسوم إضافة Apple Pay.
- تخفيض مؤقت لرسوم عمليات مدى أو Visa/Mastercard خلال فترة العرض.
- باقة ميسرة لعمليات الاشتراك والتجديد الشهري.

ونرجو أيضًا تأكيد البنود التالية كتابةً: تطبيق رسوم إدارة المخاطر على التجديدات وApple Pay، ورسوم الاسترداد، وضريبة القيمة المضافة، ورسوم Tokenization أو حفظ البطاقة، وزمن ورسوم التسوية.

نرحب بمشاركة العرض المناسب والشروط ومدته وآلية الاستفادة منه. ويمكن ترتيب اتصال قصير عند الحاجة.

مع خالص التقدير،
فريق NAVIXA SA
navixasa.com`,
  },
  paytabs: {
    to: "ksasales@paytabs.com",
    subject: "طلب عرض Payment Gateway لليوم الوطني 2026 — NAVIXA SA",
    successMessage: "تم إرسال طلب عرض اليوم الوطني إلى فريق PayTabs",
    text: `السلام عليكم ورحمة الله وبركاته،

فريق PayTabs في المملكة المحترم،

نحن فريق NAVIXA SA، منصة سعودية باشتراكات رقمية، ونستعد لإطلاق NAVIXA Plus خلال موسم اليوم الوطني السعودي 2026.

نرغب في الحصول على عرض مكتوب لحل Payment Gateway API — وليس منتج التطبيق المستقل — يدعم مدى وVisa/Mastercard وApple Pay والاشتراكات والتجديدات المتكررة وWebhooks الآمنة.

ونرجو توضيح ما إذا كان لديكم عرض اليوم الوطني 2026 أو حافز للمشاريع السعودية الجديدة يشمل أحد الخيارات التالية:

- إعفاء رسوم التأسيس أو الرسوم الشهرية لفترة محددة.
- تخفيض رسوم المعاملات أو رسوم Apple Pay.
- سعر خاص للعمليات المتكررة وحفظ البطاقة.

ولغرض المقارنة التشغيلية، نرجو تضمين: رسوم مدى، ورسوم البطاقات المحلية والدولية، والرسوم الثابتة لكل عملية، ورسوم الاسترداد، والضريبة، والتسوية، ودعم STC Pay أو Samsung Pay إن كانا متاحين.

نرجو تزويدنا بالعرض والشروط ومدة الصلاحية وخطوات التفعيل.

مع خالص التقدير،
فريق NAVIXA SA
navixasa.com`,
  },
};

function isProvider(value: unknown): value is Provider {
  return value === "moyasar" || value === "paytabs";
}

export async function POST(request: Request) {
  if (!await allowed(request)) return noStore({ error: "غير مصرح" }, 401);

  let provider: unknown;
  try {
    provider = (await request.json() as { provider?: unknown }).provider;
  } catch {
    return noStore({ error: "طلب غير صالح" }, 400);
  }
  if (!isProvider(provider)) return noStore({ error: "الجهة غير مدعومة" }, 400);

  const client = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "admin";
  const quota = limiter.consume(`navixa-admin-national-day-offer:${provider}:${client}`, 1, 24 * 60 * 60_000);
  if (!quota.allowed) {
    return noStore({ error: "أُرسل طلب عروض اليوم الوطني لهذه الجهة خلال آخر 24 ساعة.", retryAfterSeconds: quota.retryAfterSeconds }, 429);
  }

  const env = await runtimeEnv();
  const from = env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM;
  const replyTo = env.NAVIXA_ADMIN_EMAIL;
  if (!env.RESEND_API_KEY || !from || !replyTo) return noStore({ error: "إعداد بريد NAVIXA غير مكتمل" }, 409);

  const inquiry = inquiries[provider];
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [inquiry.to],
        reply_to: replyTo,
        subject: inquiry.subject,
        text: inquiry.text,
      }),
    });
    if (!response.ok) return noStore({ error: "تعذر إرسال الطلب عبر Resend" }, 502);
    return noStore({ ok: true, message: inquiry.successMessage });
  } catch {
    return noStore({ error: "تعذر الاتصال بخدمة البريد الآن" }, 502);
  }
}
