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
type Provider = "tap" | "tabby" | "tamara" | "cashew" | "telr" | "paytabs" | "myfatoorah";

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

const details = `
نرغب في الحصول على عرض سعر مكتوب ومخصص على شرائح مبيعات شهرية: من 0 إلى 30,000 ر.س، ومن 30,001 إلى 80,000 ر.س، ومن 80,001 إلى 300,000 ر.س، وما فوق ذلك.

يرجى توضيح رسوم مدى وVisa وMastercard والبطاقات الدولية وApple Pay وSTC Pay وSamsung Pay إن كانت متاحة، وTabby/Tamara إن كانت مدعومة، مع النسبة والرسم الثابت لكل وسيلة.

كما نرجو بيان رسوم التأسيس والاشتراك الشهري وTokenization وحفظ البطاقة والتجديدات الدورية والاسترداد والاعتراضات والتسوية وضريبة القيمة المضافة، مع تفاصيل Sandbox وAPI/SDK وWebhooks الموقعة ودعم idempotency.

ونود كذلك معرفة أي عروض لليوم الوطني السعودي 2026 أو برامج للشركات الناشئة يمكن أن تشمل إعفاء رسوم التأسيس أو Apple Pay أو تخفيضًا مؤقتًا لرسوم العمليات.
`;

const inquiries: Record<Provider, { to: string; subject: string; line: string; extra?: string; successMessage: string }> = {
  tap: {
    to: "support@tap.company",
    subject: "طلب عرض سعر مخصص لبوابة دفع NAVIXA في السعودية",
    line: "ندرس Tap لمرونة API وSDK وتوفير مدى وApple Pay وSTC Pay وطرق الدفع المحلية من تجربة Checkout موحدة.",
    successMessage: "تم إرسال طلب العرض المخصص إلى فريق Tap",
  },
  tabby: {
    to: "partner@tabby.sa",
    subject: "طلب تفعيل تاجر وعرض تسعير Tabby — NAVIXA SA",
    line: "نرغب في اعتماد Tabby كخيار تمويل منفصل لباقات NAVIXA Plus المرنة، مع الحفاظ على مدى والبطاقات كخيارات الدفع الأساسية.",
    extra: `
يرجى تزويدنا بشروط قبول الخدمات والاشتراكات الرقمية، والحد الأدنى والأقصى للطلب في السعودية، ومعدل التاجر والرسم الثابت ودورة التسوية والاسترداد والإلغاء والاعتراضات.

ندرس مبدئيًا باقة 5 أشهر بقيمة 119 ر.س وسنة كاملة بقيمة 269 ر.س؛ نرجو بيان مدى أهلية القيم لخيارات Pay in 4 أو أي خطة متاحة. نحتاج أيضًا خطوات فتح حساب تاجر، مفاتيح الاختبار، QA قبل مفاتيح الحي، API/SDK، Webhooks، آلية التحقق الخادمي، ومتطلبات عرض علامة Tabby في Checkout.
`,
    successMessage: "تم إرسال طلب تفعيل وتسعير Tabby إلى فريق Tabby",
  },
  tamara: {
    to: "support@tamara.co",
    subject: "طلب تفعيل تاجر وعرض تسعير وتكامل Tamara — NAVIXA SA",
    line: "نرغب في اعتماد Tamara كخيار تمويل منفصل لباقات NAVIXA Plus المرنة، مع إبقاء مدى والبطاقات مسار الدفع الأساسي.",
    extra: `
ونرجو توضيح مدى قبول الاشتراكات والخدمات الرقمية، والحد الأدنى والأقصى لقيمة الطلب في السعودية، ورسوم التاجر والرسم الثابت والتسوية والاسترداد والإلغاء والاعتراضات.

الباقات التي ندرسها مبدئيًا هي 5 أشهر بقيمة 119 ر.س وسنة كاملة بقيمة 269 ر.س؛ نرجو توضيح هل تؤهل هذه القيم لخيارات التقسيط، وما عدد الدفعات الممكنة. نحتاج كذلك خطوات فتح حساب تاجر، وSandbox، وAPI/SDK، وWebhooks الموقعة، وبيئة QA، ومتطلبات اعتماد علامة Tamara داخل Checkout، وآلية دعم التجديدات أو تجنب تمويل التجديد الشهري المنخفض القيمة.
`,
    successMessage: "تم إرسال طلب تفعيل وتسعير Tamara إلى فريق Tamara",
  },
  cashew: {
    to: "support@cashewpayments.com",
    subject: "استفسار شراكة وتوفر تمويل للتاجر في السعودية — NAVIXA SA",
    line: "نرغب في التحقق أولًا مما إذا كانت Cashew تقبل تجارًا وخدمات رقمية في المملكة العربية السعودية، قبل طلب عرض تكامل كامل.",
    extra: `
إذا كانت الخدمة متاحة في السعودية، نرجو تزويدنا بشروط فتح حساب تاجر، العملات المدعومة، الحد الأدنى والأقصى للطلب، الرسوم والتسوية، وAPI/SDK وWebhook وبيئة الاختبار. ندرس باقات رقمية بقيمة 119 ر.س لخمس أشهر و269 ر.س لسنة كاملة.
`,
    successMessage: "تم إرسال استفسار توفر Cashew للسوق السعودي",
  },
  telr: {
    to: "sales@telr.com",
    subject: "طلب عرض سعر مخصص لبوابة دفع NAVIXA في السعودية",
    line: "ندرس Telr لوسائل الدفع السعودية وروابط الدفع والفواتير وApple Pay، ونرغب في تسعير يتناسب مع إطلاق اشتراكات رقمية متنامٍ.",
    successMessage: "تم إرسال طلب العرض المخصص إلى فريق Telr",
  },
  paytabs: {
    to: "ksasales@paytabs.com",
    subject: "طلب عرض سعر مخصص لـ Payment Gateway API — NAVIXA SA",
    line: "نحتاج عرض Payment Gateway API مخصصًا، وليس تسعير تطبيق Paymes فقط، لتكامل اشتراكات NAVIXA داخل منصتنا.",
    successMessage: "تم إرسال طلب العرض المخصص إلى فريق PayTabs",
  },
  myfatoorah: {
    to: "supportksa@myfatoorah.com",
    subject: "طلب عرض سعر مخصص لبوابة دفع NAVIXA في السعودية",
    line: "ندرس MyFatoorah لخيارات التسوية والدفعات المتكررة وروابط الدفع، ونرغب في عرض يناسب منصة اشتراكات رقمية سعودية.",
    successMessage: "تم إرسال طلب العرض المخصص إلى فريق MyFatoorah",
  },
};

function isProvider(value: unknown): value is Provider {
  return value === "tap" || value === "tabby" || value === "tamara" || value === "cashew" || value === "telr" || value === "paytabs" || value === "myfatoorah";
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
  const quota = limiter.consume(`navixa-admin-custom-quote:${provider}:${client}`, 1, 7 * 24 * 60 * 60_000);
  if (!quota.allowed) {
    return noStore({ error: "أُرسل طلب عرض مخصص لهذه الجهة خلال آخر 7 أيام.", retryAfterSeconds: quota.retryAfterSeconds }, 429);
  }

  const env = await runtimeEnv();
  const from = env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM;
  const replyTo = env.NAVIXA_ADMIN_EMAIL;
  if (!env.RESEND_API_KEY || !from || !replyTo) return noStore({ error: "إعداد بريد NAVIXA غير مكتمل" }, 409);

  const inquiry = inquiries[provider];
  const text = `السلام عليكم ورحمة الله وبركاته،

فريق ${provider === "myfatoorah" ? "MyFatoorah" : provider === "paytabs" ? "PayTabs" : provider === "tabby" ? "Tabby" : provider === "tamara" ? "Tamara" : provider === "cashew" ? "Cashew" : provider === "telr" ? "Telr" : "Tap Payments"} المحترم،

نحن فريق NAVIXA SA، منصة سعودية باشتراكات شهرية وربع سنوية تساعد المستخدم على تنظيم يومه بأدوات ذكية مع تجربة خصوصية أولًا. نستعد لإطلاق تدريجي داخل المملكة ونبحث عن بوابة دفع موثوقة تناسب نموذج اشتراكات متناميًا وتجربة دفع سهلة على الجوال والويب.

${inquiry.line}
${details}
${inquiry.extra || ""}

من الناحية التقنية تعتمد NAVIXA على Next.js/Vinext وCloudflare Workers وD1، ولدينا مسار تحقق خادمي وWebhook مهيأ للاختبار. يسعدنا تزويدكم بالتفاصيل المطلوبة وإجراء اختبار Sandbox ثم اختبار حي محدود بعد اعتماد الحساب.

نأمل تزويدنا بالعرض والشروط والأحكام، وإرسال الرد إلى: ${replyTo}.

مع خالص التقدير،
فريق NAVIXA SA
https://navixasa.com
`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [inquiry.to], reply_to: replyTo, subject: inquiry.subject, text }),
    });
    if (!response.ok) return noStore({ error: "تعذر إرسال الطلب عبر Resend" }, 502);
    return noStore({ ok: true, message: inquiry.successMessage });
  } catch {
    return noStore({ error: "تعذر الاتصال بخدمة البريد الآن" }, 502);
  }
}
