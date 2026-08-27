import { NextResponse } from "next/server.js";
import { createSallaManualIntentId, SALLA_MANUAL_AMOUNT_MINOR, SALLA_MANUAL_CURRENCY, SALLA_MANUAL_PLAN_CODE, SALLA_MANUAL_PRODUCT_ID, SALLA_PRODUCT_URL } from "../../../../billing/sallaManualReview.ts";
import { getUserAuthSettings, refreshUserSessionIfNeeded, resolveUserSession, trustedUserMutation, type D1Database } from "../../../../../worker/userAuth.ts";

type Statement = { bind: (...values: unknown[]) => Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type Database = D1Database & { prepare: (sql: string) => Statement; batch: (statements: Statement[]) => Promise<unknown[]> };
type WorkerBinding = { env?: { DB?: Database } };
type ExistingReview = { id: string; checkout_intent_id: string; status: "pending" | "processing" };

async function database(): Promise<Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: Database }).DB || null; }
}

function privateHeaders(cookie?: string | null) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
  if (cookie) headers["Set-Cookie"] = cookie;
  return headers;
}

/**
 * ينشئ طلب مراجعة مقيدًا بحساب NAVIXA فقط. لا يستقبل بريدًا، رقم طلب، إيصالًا أو حالة دفع.
 * إن ضغط العميل الزر أكثر من مرة يعاد الطلب المعلق نفسه؛ لا يُنشأ استحقاق هنا.
 */
export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "طلب غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const db = await database();
  if (!db) return NextResponse.json({ error: "خدمة المراجعة غير متاحة مؤقتًا" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const [settings, session] = await Promise.all([getUserAuthSettings(db), resolveUserSession(request, db)]);
    if (!settings.userAuthEnabled) return NextResponse.json({ error: "تسجيل الدخول غير متاح حاليًا" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    if (!session) return NextResponse.json({ error: "سجّل الدخول إلى حساب NAVIXA قبل الانتقال إلى سلة" }, { status: 401, headers: privateHeaders() });
    const refreshed = await refreshUserSessionIfNeeded(request, db, session).catch(() => ({ session, cookie: null }));
    const headers = privateHeaders(refreshed.cookie);
    const existing = (await db.prepare("SELECT id,checkout_intent_id,status FROM navixa_salla_manual_reviews WHERE user_id=? AND status IN ('pending','processing') LIMIT 1").bind(session.userId).all<ExistingReview>()).results[0];
    if (existing) return NextResponse.json({ ok: true, reviewId: existing.id, intentId: existing.checkout_intent_id, state: "pending", checkoutUrl: SALLA_PRODUCT_URL }, { headers });

    const now = new Date().toISOString();
    const reviewId = crypto.randomUUID();
    const intentId = createSallaManualIntentId();
    try {
      await db.batch([
        db.prepare("INSERT INTO navixa_salla_checkout_intents (id,user_id,plan_code,expected_product_id,expected_amount_minor,currency,status,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,'pending',?,?,?)").bind(intentId, session.userId, SALLA_MANUAL_PLAN_CODE, SALLA_MANUAL_PRODUCT_ID, SALLA_MANUAL_AMOUNT_MINOR, SALLA_MANUAL_CURRENCY, now, now, new Date(Date.now() + 14 * 86400000).toISOString()),
        db.prepare("INSERT INTO navixa_salla_manual_reviews (id,checkout_intent_id,user_id,review_lock,status,reviewed_by,salla_order_id,verification_method,created_at,reviewed_at) VALUES (?,?,?,?,'pending','','','',?,'')").bind(reviewId, intentId, session.userId, `open:${session.userId}`, now),
      ]);
    } catch {
      const raced = (await db.prepare("SELECT id,checkout_intent_id,status FROM navixa_salla_manual_reviews WHERE user_id=? AND status IN ('pending','processing') LIMIT 1").bind(session.userId).all<ExistingReview>()).results[0];
      if (!raced) throw new Error("manual_review_insert_failed");
      return NextResponse.json({ ok: true, reviewId: raced.id, intentId: raced.checkout_intent_id, state: "pending", checkoutUrl: SALLA_PRODUCT_URL }, { headers });
    }
    return NextResponse.json({ ok: true, reviewId, intentId, state: "pending", checkoutUrl: SALLA_PRODUCT_URL }, { headers });
  } catch {
    return NextResponse.json({ error: "تعذر تجهيز طلب المراجعة الآن" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
