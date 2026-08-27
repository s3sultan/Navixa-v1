import { NextResponse } from "next/server.js";
import { canApproveManualReview, isSallaManualOrderId, normalizeSallaManualOrderId, SALLA_MANUAL_AMOUNT_MINOR, SALLA_MANUAL_CURRENCY, SALLA_MANUAL_PLAN_CODE, SALLA_MANUAL_PRODUCT_ID, SALLA_MANUAL_REVIEW_DAYS } from "../../../billing/sallaManualReview.ts";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

type Statement = { bind: (...values: unknown[]) => Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = { prepare: (sql: string) => Statement; batch: (statements: Statement[]) => Promise<unknown[]> };
type WorkerBinding = { env?: { DB?: Database } };
type Review = { id: string; checkout_intent_id: string; user_id: string; status: string; created_at: string; email: string };
type ExistingOrder = { order_id: string };
type Subscriber = { user_id: string; subscription_ends_at: string };

const noStore = { "Cache-Control": "no-store" };
const changed = (value: unknown) => Number((value as { meta?: { changes?: number } })?.meta?.changes || 0);

async function database(): Promise<Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: Database }).DB || null; }
}
async function admin(request: Request) {
  const secret = await resolveAdminJwtSecret();
  if (!secret || !isTrustedSameOriginRequest(request)) return null;
  return verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret);
}
function empty(value: unknown, limit: number) { return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : ""; }

export async function GET(request: Request) {
  if (!await admin(request)) return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: noStore });
  const db = await database();
  if (!db) return NextResponse.json({ reviews: [], expected: { productId: SALLA_MANUAL_PRODUCT_ID, amountMinor: SALLA_MANUAL_AMOUNT_MINOR, currency: SALLA_MANUAL_CURRENCY } }, { headers: noStore });
  try {
    const rows = await db.prepare("SELECT r.id,r.checkout_intent_id,r.user_id,r.status,r.created_at,u.email FROM navixa_salla_manual_reviews r JOIN navixa_users u ON u.id=r.user_id WHERE r.status IN ('pending','processing') ORDER BY r.created_at ASC LIMIT 80").all<Review>();
    return NextResponse.json({ reviews: rows.results, expected: { productId: SALLA_MANUAL_PRODUCT_ID, amountMinor: SALLA_MANUAL_AMOUNT_MINOR, currency: SALLA_MANUAL_CURRENCY } }, { headers: noStore });
  } catch { return NextResponse.json({ error: "تعذر تحميل قائمة المراجعة" }, { status: 503, headers: noStore }); }
}

/**
 * هذا الإجراء خاص بالمدير. يجب عليه التحقق يدويًا داخل سلة من paid + المنتج + 19.00 SAR
 * وتطابق بريد سلة مع البريد المعروض هنا قبل الضغط. العميل لا يرسل أي إثبات أو رقم طلب.
 */
export async function POST(request: Request) {
  const operator = await admin(request);
  if (!operator) return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: noStore });
  const body = await request.json().catch(() => ({})) as { reviewId?: unknown; sallaOrderId?: unknown };
  const reviewId = empty(body.reviewId, 80);
  const suppliedOrderId = empty(body.sallaOrderId, 128);
  if (!reviewId || !isSallaManualOrderId(suppliedOrderId)) return NextResponse.json({ error: "أدخل رقم طلب سلة صحيحًا" }, { status: 400, headers: noStore });
  const sallaOrderId = normalizeSallaManualOrderId(suppliedOrderId);
  const db = await database();
  if (!db) return NextResponse.json({ error: "التخزين غير متاح الآن" }, { status: 503, headers: noStore });
  try {
    const review = (await db.prepare("SELECT r.id,r.checkout_intent_id,r.user_id,r.status,r.created_at,u.email FROM navixa_salla_manual_reviews r JOIN navixa_users u ON u.id=r.user_id WHERE r.id=? LIMIT 1").bind(reviewId).all<Review>()).results[0];
    if (!review || !canApproveManualReview(review.status)) return NextResponse.json({ error: "هذا الطلب ليس معلقًا للمراجعة أو تمت معالجته سابقًا" }, { status: 409, headers: noStore });
    const claim = await db.prepare("UPDATE navixa_salla_manual_reviews SET status='processing' WHERE id=? AND status='pending'").bind(review.id).run();
    if (!changed(claim)) return NextResponse.json({ error: "تتم معالجة هذا الطلب بالفعل" }, { status: 409, headers: noStore });
    const restore = async () => { await db.prepare("UPDATE navixa_salla_manual_reviews SET status='pending' WHERE id=? AND status='processing'").bind(review.id).run().catch(() => {}); };
    const duplicate = (await db.prepare("SELECT order_id FROM navixa_salla_orders WHERE order_id=? LIMIT 1").bind(sallaOrderId).all<ExistingOrder>()).results[0];
    if (duplicate) { await restore(); return NextResponse.json({ error: "رقم طلب سلة استُخدم مسبقًا ولا يمكن تفعيله مرتين" }, { status: 409, headers: noStore }); }
    const intent = (await db.prepare("SELECT id,user_id,plan_code,expected_product_id,expected_amount_minor,currency FROM navixa_salla_checkout_intents WHERE id=? AND user_id=? LIMIT 1").bind(review.checkout_intent_id, review.user_id).all<{ id: string; user_id: string; plan_code: string; expected_product_id: string; expected_amount_minor: number; currency: string }>()).results[0];
    if (!intent || intent.plan_code !== SALLA_MANUAL_PLAN_CODE || intent.expected_product_id !== SALLA_MANUAL_PRODUCT_ID || intent.expected_amount_minor !== SALLA_MANUAL_AMOUNT_MINOR || intent.currency !== SALLA_MANUAL_CURRENCY) { await restore(); return NextResponse.json({ error: "مطابقة الباقة الداخلية غير سليمة؛ لم يُمنح أي استحقاق" }, { status: 409, headers: noStore }); }
    const subscriber = (await db.prepare("SELECT user_id,subscription_ends_at FROM navixa_subscribers WHERE contact=? LIMIT 1").bind(review.email).all<Subscriber>()).results[0];
    if (subscriber?.user_id && subscriber.user_id !== review.user_id) { await restore(); return NextResponse.json({ error: "مطابقة حساب NAVIXA غير سليمة؛ راجع البريد داخل سلة" }, { status: 409, headers: noStore }); }
    const now = new Date();
    const nextEndsAt = new Date(Math.max(now.getTime(), Date.parse(subscriber?.subscription_ends_at || "") || 0) + SALLA_MANUAL_REVIEW_DAYS * 86400000).toISOString();
    const nowIso = now.toISOString();
    try {
      await db.batch([
        db.prepare("INSERT INTO navixa_salla_orders (order_id,checkout_intent_id,user_id,product_id,amount_minor,currency,payment_state,provider_customer_ref,provider_payload_hash,paid_at,created_at,updated_at) VALUES (?,?,?,?,?,?,'verified_paid','manual_dashboard','',?,?,?)").bind(sallaOrderId, review.checkout_intent_id, review.user_id, SALLA_MANUAL_PRODUCT_ID, SALLA_MANUAL_AMOUNT_MINOR, SALLA_MANUAL_CURRENCY, nowIso, nowIso, nowIso),
        db.prepare("INSERT INTO navixa_salla_entitlements (id,checkout_intent_id,salla_order_id,user_id,plan_code,status,starts_at,ends_at,settled_at,revoked_at) VALUES (?,?,?,?,?,'active',?,?,?,'')").bind(crypto.randomUUID(), review.checkout_intent_id, sallaOrderId, review.user_id, SALLA_MANUAL_PLAN_CODE, nowIso, nextEndsAt, nowIso),
        db.prepare("INSERT INTO navixa_subscribers (id,user_id,contact,display_name,plan,status,trial_started_at,trial_ends_at,subscription_ends_at,source,created_at,updated_at) VALUES (?,?,?,?,?,'active','','',?,'salla_manual_review',?,?) ON CONFLICT(contact) DO UPDATE SET user_id=excluded.user_id,plan=excluded.plan,status='active',trial_ends_at='',subscription_ends_at=excluded.subscription_ends_at,source='salla_manual_review',updated_at=excluded.updated_at").bind(crypto.randomUUID(), review.user_id, review.email, "", "monthly", nextEndsAt, nowIso, nowIso),
        db.prepare("UPDATE navixa_salla_checkout_intents SET status='settled',updated_at=? WHERE id=? AND user_id=?").bind(nowIso, review.checkout_intent_id, review.user_id),
        db.prepare("UPDATE navixa_salla_manual_reviews SET status='approved',review_lock=?,reviewed_by=?,salla_order_id=?,verification_method='salla_dashboard_manual',reviewed_at=? WHERE id=? AND status='processing'").bind(`closed:${review.id}`, operator.email, sallaOrderId, nowIso, review.id),
      ]);
    } catch { await restore(); return NextResponse.json({ error: "تعذر تسجيل التفعيل؛ لم يُمنح أي استحقاق. أعد المراجعة لاحقًا." }, { status: 503, headers: noStore }); }
    return NextResponse.json({ ok: true, message: "تم تفعيل NAVIXA Plus بعد المراجعة اليدوية الموثقة في سلة", endsAt: nextEndsAt }, { headers: noStore });
  } catch { return NextResponse.json({ error: "تعذر إتمام المراجعة الآن" }, { status: 503, headers: noStore }); }
}
