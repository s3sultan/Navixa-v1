import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";
import { ensureRuntimeFeatureSchema, publicRuntimeFeatures, readRuntimeFeatureSettings, runtimeFeatureKeys, type RuntimeFeatureDatabase, type RuntimeFeatureSettings } from "../../../runtimeFeatures.ts";

async function db(): Promise<RuntimeFeatureDatabase | null> {
  try { return (await import("cloudflare:workers") as { env?: { DB?: RuntimeFeatureDatabase } }).env?.DB || null; }
  catch { return (globalThis as { DB?: RuntimeFeatureDatabase }).DB || null; }
}

async function allowed(request: Request) {
  const secret = await resolveAdminJwtSecret();
  return Boolean(secret && (request.method === "GET" || isTrustedSameOriginRequest(request)) && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret));
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function toSettings(body: Record<string, unknown>): RuntimeFeatureSettings {
  return {
    floating_assistant_enabled: String(body.floatingAssistantEnabled === true) as "true" | "false",
    game_ad_enabled: String(body.gameAdEnabled === true) as "true" | "false",
    health_nudge_enabled: String(body.healthNudgeEnabled === true) as "true" | "false",
    member_platform_ribbon_enabled: String(body.memberPlatformRibbonEnabled === true) as "true" | "false",
    matches_home_enabled: String(body.matchesHomeEnabled === true) as "true" | "false",
    usage_analytics_enabled: String(body.usageAnalyticsEnabled === true) as "true" | "false",
    public_counter_enabled: String(body.publicCounterEnabled === true) as "true" | "false",
  };
}

export async function GET(request: Request) {
  if (!await allowed(request)) return noStore({ error: "غير مصرح" }, 401);
  const database = await db();
  if (!database) return noStore({ error: "التخزين غير مهيأ" }, 503);
  await ensureRuntimeFeatureSchema(database);
  const settings = await readRuntimeFeatureSettings(database);
  return noStore({ settings, features: publicRuntimeFeatures(settings), scope: "الصفحة الرئيسية والقياس الاختياري فقط؛ لا توجد أسرار أو حسابات أو إعدادات دفع هنا." });
}

export async function POST(request: Request) {
  if (!await allowed(request)) return noStore({ error: "غير مصرح" }, 401);
  const database = await db();
  if (!database) return noStore({ error: "التخزين غير مهيأ" }, 503);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const settings = toSettings(body);
  const now = new Date().toISOString();
  await ensureRuntimeFeatureSchema(database);
  for (const key of runtimeFeatureKeys) {
    await database.prepare("INSERT INTO navixa_runtime_feature_settings(setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(key, settings[key], now).run();
  }
  return noStore({ ok: true, message: "تم حفظ مفاتيح التشغيل. لا حُذفت بيانات ولا تغيّرت الحسابات أو الدفع.", settings, features: publicRuntimeFeatures(settings) });
}
