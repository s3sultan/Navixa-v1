type Statement = { bind: (...values: unknown[]) => Statement; run: () => Promise<unknown> };
type Database = { prepare: (sql: string) => Statement };
type InquiryEnv = { DB: Database; RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string };
const MESSAGE_KEY = "moyasar_sales_fees_inquiry_2026_08";
const RECIPIENT = "care@moyasar.com";
const SUBJECT = "استفسار عن رسوم وتفعيل الدفع لمنصة NAVIXA SA";

const BODY = `السلام عليكم ورحمة الله وبركاته،

أنا مسؤول منصة NAVIXA SA، وهي منصة اشتراكات رقمية تقدم خدمة NAVIXA Plus للمستخدمين داخل المملكة.

نرغب في تفعيل استقبال المدفوعات الحية عبر مُيسر، ونحتاج عرضًا مكتوبًا يوضح الرسوم والتسوية المناسبة لطبيعة اشتراكاتنا الشهرية والحملات الترويجية المحدودة.

نأمل تزويدنا بالتفاصيل التالية:

1. نسبة ورسوم كل عملية ناجحة لوسائل الدفع المتاحة: مدى، فيزا، ماستركارد، Apple Pay، STC Pay.
2. هل توجد رسوم ثابتة على كل عملية؟ وهل تختلف حسب وسيلة الدفع أو قيمة العملية؟
3. هل تضاف ضريبة القيمة المضافة على رسوم البوابة؟ وكيف تظهر في كشف التسوية؟
4. ما رسوم الاسترجاع الكامل والجزئي؟ وهل تعاد رسوم المعاملة الأصلية عند الاسترجاع؟
5. ما رسوم الاعتراضات البنكية Chargebacks وآلية التعامل معها؟
6. ما جدول التسوية الفعلي لحسابنا، والحد الأدنى للتحويل، وهل توجد رسوم للتسوية المبكرة؟
7. هل تختلف الرسوم أو المتطلبات في حال قبول المدفوعات من بطاقات دولية؟
8. هل تدعمون الاشتراكات أو التجديدات المتكررة؟ وإن كانت متاحة، فما الرسوم والمتطلبات الخاصة بها؟
9. ما المستندات المطلوبة لإتمام تفعيل حسابنا الحي؟
10. نرجو تأكيد طرق الدفع التي يمكن تفعيلها لحسابنا عند الإطلاق الأول، مع توصيتكم بالطرق المناسبة للاشتراكات الرقمية.

لدينا أسعار اشتراك أساسية شهرية، مع عرض مؤسسين محدود لفترة قصيرة بأسعار مخفضة لأول شهر، لذلك نحتاج معرفة أثر الرسوم الثابتة على العمليات الصغيرة قبل اعتماد الحملة نهائيًا.

موقع المنصة: https://navixasa.com

شكرًا لكم، وننتظر عرض الرسوم وخطوات التفعيل.

تحياتي،
فريق NAVIXA SA
support@navixasa.com`;

const changed = (value: unknown) => ((value as { meta?: { changes?: number } })?.meta?.changes || 0);

async function schema(database: Database) {
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_outbound_mail_log (message_key TEXT PRIMARY KEY,recipient TEXT NOT NULL,subject TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',provider_id TEXT NOT NULL DEFAULT '',error_message TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,sent_at TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL)").run();
}

/** Sends the approved sales inquiry only once after deployment. It never logs API keys or email content beyond the approved template. */
export async function sendApprovedMoyasarSalesInquiry(env: InquiryEnv) {
  await schema(env.DB);
  const now = new Date().toISOString();
  const created = await env.DB.prepare("INSERT OR IGNORE INTO navixa_outbound_mail_log (message_key,recipient,subject,status,provider_id,error_message,created_at,sent_at,updated_at) VALUES (?,?,?,'pending','','',?,'',?)").bind(MESSAGE_KEY, RECIPIENT, SUBJECT, now, now).run();
  if (!changed(created)) return { status: "already_processed" as const };
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    await env.DB.prepare("UPDATE navixa_outbound_mail_log SET status='failed',error_message=?,updated_at=? WHERE message_key=?").bind("resend_not_configured", now, MESSAGE_KEY).run();
    return { status: "failed" as const, reason: "resend_not_configured" };
  }
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [RECIPIENT], subject: SUBJECT, text: BODY }) });
  const payload = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown };
  if (!response.ok) {
    await env.DB.prepare("UPDATE navixa_outbound_mail_log SET status='failed',error_message=?,updated_at=? WHERE message_key=?").bind(`resend_${response.status}`, now, MESSAGE_KEY).run();
    return { status: "failed" as const, reason: `resend_${response.status}` };
  }
  const providerId = typeof payload.id === "string" ? payload.id.slice(0, 160) : "";
  await env.DB.prepare("UPDATE navixa_outbound_mail_log SET status='sent',provider_id=?,error_message='',sent_at=?,updated_at=? WHERE message_key=?").bind(providerId, now, now, MESSAGE_KEY).run();
  return { status: "sent" as const, providerId };
}
