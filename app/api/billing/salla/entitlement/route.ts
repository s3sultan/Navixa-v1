import { NextResponse } from "next/server.js";
import { safeSallaCheckoutIntent, toSallaReturnStatus } from "../../../../billing/sallaEntitlementStatus.ts";
import { getUserAuthSettings, refreshUserSessionIfNeeded, resolveUserSession, type D1Database } from "../../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type WorkerBinding = { env?: { DB?: Database } };
type EntitlementRow = { status: string; ends_at: string };
type IntentRow = { status: string };

const privateHeaders = (cookie?: string | null): Record<string, string> => {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
  if (cookie) headers["Set-Cookie"] = cookie;
  return headers;
};

async function database(): Promise<Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: Database }).DB || null; }
}

/**
 * واجهة المستخدم بعد العودة من سلة. تعتمد فقط على جلسة NAVIXA وسجل الاستحقاق
 * الداخلي المربوط بالنية، ولا تقبل رقم طلب أو بريد أو حالة دفع من المتصفح.
 */
export async function GET(request: Request) {
  const db = await database();
  if (!db) return NextResponse.json({ error: "خدمة التحقق غير متاحة مؤقتًا" }, { status: 503, headers: { "Cache-Control": "no-store" } });

  const intentId = safeSallaCheckoutIntent(new URL(request.url).searchParams.get("intent"));
  if (!intentId) return NextResponse.json({ error: "مرجع التحقق غير صالح" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  try {
    const [settings, resolved] = await Promise.all([getUserAuthSettings(db), resolveUserSession(request, db)]);
    if (!settings.userAuthEnabled) return NextResponse.json({ error: "تسجيل الدخول غير متاح" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    if (!resolved) return NextResponse.json({ error: "يلزم تسجيل الدخول لمراجعة اشتراكك" }, { status: 401, headers: privateHeaders() });
    const refreshed = await refreshUserSessionIfNeeded(request, db, resolved).catch(() => ({ session: resolved, cookie: null }));
    const headers = privateHeaders(refreshed.cookie);

    const entitlement = (await db.prepare(
      "SELECT status,ends_at FROM navixa_salla_entitlements WHERE checkout_intent_id=? AND user_id=? LIMIT 1",
    ).bind(intentId, refreshed.session.userId).all<EntitlementRow>()).results[0] || null;
    if (entitlement) return NextResponse.json(toSallaReturnStatus({ status: entitlement.status, endsAt: entitlement.ends_at }), { headers });

    const intent = (await db.prepare(
      "SELECT status FROM navixa_salla_checkout_intents WHERE id=? AND user_id=? LIMIT 1",
    ).bind(intentId, refreshed.session.userId).all<IntentRow>()).results[0] || null;
    if (!intent || ["cancelled", "expired", "failed"].includes(intent.status)) return NextResponse.json({ state: "not_activated" }, { headers });
    return NextResponse.json({ state: "pending" }, { headers });
  } catch {
    // فشل التخزين ليس نجاحًا ولا سببًا لمنح وصول؛ يعاد كخطأ قابل لإعادة المحاولة.
    return NextResponse.json({ error: "تعذر التحقق من الاستحقاق الآن" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
