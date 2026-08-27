import { NextResponse } from "next/server.js";
import { verifySallaWebhookSignature } from "../../../../billing/providers/salla.ts";
import { parseSallaWebhookEvent } from "../../../../billing/sallaWebhookEvent.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type D1Database = { prepare: (sql: string) => D1Statement };
type RuntimeEnv = { DB?: D1Database; SALLA_WEBHOOK_SECRET?: string; SALLA_WEBHOOK_ENABLED?: string };

async function runtime(): Promise<RuntimeEnv> {
  let bindings: RuntimeEnv = {};
  try { bindings = (await import("cloudflare:workers") as { env?: RuntimeEnv }).env || {}; }
  catch { /* اختبارات Node المحلية لا توفر cloudflare:workers. */ }
  // مع nodejs_compat تضع Cloudflare النصوص والأسرار في process.env. يبقى هذا
  // fallback محدودًا للمتغيرات المطلوبة فقط ولا يطبع أي قيمة حساسة.
  const processEnv = typeof process === "undefined" ? {} : process.env as Record<string, string | undefined>;
  const globals = globalThis as RuntimeEnv;
  return {
    DB: bindings.DB || globals.DB,
    SALLA_WEBHOOK_ENABLED: bindings.SALLA_WEBHOOK_ENABLED || processEnv.SALLA_WEBHOOK_ENABLED || globals.SALLA_WEBHOOK_ENABLED,
    SALLA_WEBHOOK_SECRET: bindings.SALLA_WEBHOOK_SECRET || processEnv.SALLA_WEBHOOK_SECRET || globals.SALLA_WEBHOOK_SECRET,
  };
}

/**
 * نقطة استقبال مغلقة افتراضيًا. لا تمنح هذه النقطة استحقاقًا ولا تنشئ دفعًا.
 * يلزم تطبيق db/migrations/20260827_salla_entitlement_foundation.sql قبل تشغيلها.
 * تفعيل التسوية يتطلب في مرحلة لاحقة مطابقة منتج/نية/مبلغ وإجراءً ذريًا منفصلًا.
 */
export async function POST(request: Request) {
  const env = await runtime();
  if (env.SALLA_WEBHOOK_ENABLED !== "true" || !env.SALLA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Salla webhook is not enabled" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const rawBody = await request.text();
  const valid = await verifySallaWebhookSignature({
    rawBody,
    signature: request.headers.get("x-salla-signature"),
    secret: env.SALLA_WEBHOOK_SECRET,
  });
  if (!valid) return NextResponse.json({ error: "Invalid Salla webhook signature" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const payload = await Promise.resolve().then(() => JSON.parse(rawBody) as Record<string, unknown>).catch(() => null);
  const event = payload ? await parseSallaWebhookEvent(rawBody, payload) : null;
  if (!event) return NextResponse.json({ error: "Invalid Salla webhook payload" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const database = env.DB;
  if (!database) return NextResponse.json({ error: "Billing store unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });

  try {
    const now = new Date().toISOString();
    // إدراج ذري: لا يسمح المفتاح الفريد لحدث المزود بتسليم متوازٍ أن ينشئ سجلات متعددة.
    const claimed = await database.prepare(
      "INSERT INTO navixa_salla_events (provider_event_key,event_type,order_id,payload_hash,processing_state,received_at) VALUES (?,?,?,?,?,?) ON CONFLICT(provider_event_key) DO NOTHING RETURNING payload_hash",
    ).bind(event.eventId, event.eventType, event.orderId, event.payloadHash, "received", now).all<{ payload_hash: string }>();
    if (!claimed.results.length) {
      const recorded = await database.prepare("SELECT payload_hash FROM navixa_salla_events WHERE provider_event_key=? LIMIT 1").bind(event.eventId).all<{ payload_hash: string }>();
      if (recorded.results[0]?.payload_hash !== event.payloadHash) return NextResponse.json({ error: "Conflicting Salla event payload" }, { status: 409, headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ ok: true, duplicate: true, entitlement: "not_activated" }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: true, recorded: true, entitlement: "not_activated" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // لا نعيد إنشاء دفع ولا نمنح وصولًا؛ 503 يسمح لسلة بإعادة التسليم فقط.
    return NextResponse.json({ error: "Temporary webhook storage failure" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
