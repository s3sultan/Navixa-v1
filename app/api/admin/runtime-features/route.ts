import { NextResponse } from "next/server.js";
import { requireAdminPermission } from "../../../../worker/adminAccess.ts";
import { writeAdminActivity, type AdminActivityDatabase } from "../../../../worker/adminActivity.ts";
import { ensureRuntimeFeatureSchema, publicRuntimeFeatures, readRuntimeFeatureSettings, runtimeFeatureKeys, type RuntimeFeatureDatabase, type RuntimeFeatureSettings } from "../../../runtimeFeatures.ts";

type Database = RuntimeFeatureDatabase & AdminActivityDatabase;

async function db(): Promise<Database | null> {
  try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; }
  catch { return (globalThis as { DB?: Database }).DB || null; }
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
  if (!await requireAdminPermission(request, "runtime.manage")) return noStore({ error: "غير مصرح" }, 401);
  const database = await db();
  if (!database) return noStore({ error: "التخزين غير مهيأ" }, 503);
  await ensureRuntimeFeatureSchema(database);
  const settings = await readRuntimeFeatureSettings(database);
  return noStore({ settings, features: publicRuntimeFeatures(settings), scope: "الصفحة الرئيسية والقياس الاختياري فقط؛ لا توجد أسرار أو حسابات أو إعدادات دفع هنا." });
}

export async function POST(request: Request) {
  const identity = await requireAdminPermission(request, "runtime.manage");
  if (!identity) return noStore({ error: "غير مصرح" }, 401);
  const database = await db();
  if (!database) return noStore({ error: "التخزين غير مهيأ" }, 503);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const settings = toSettings(body);
  const now = new Date().toISOString();
  await ensureRuntimeFeatureSchema(database);
  const previous = await readRuntimeFeatureSettings(database);
  const changed = runtimeFeatureKeys.filter(key => previous[key] !== settings[key]);
  try {
    for (const key of runtimeFeatureKeys) {
      await database.prepare("INSERT INTO navixa_runtime_feature_settings(setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(key, settings[key], now).run();
    }
    await writeAdminActivity(database, {
      adminEmail: identity.email,
      action: "runtime_features.update",
      resource: "runtime_features",
      metadata: { changed, changedCount: changed.length },
    });
    return noStore({ ok: true, message: "تم حفظ مفاتيح التشغيل وتسجيل الإجراء الإداري.", settings, features: publicRuntimeFeatures(settings) });
  } catch {
    await writeAdminActivity(database, {
      adminEmail: identity.email,
      action: "runtime_features.update",
      resource: "runtime_features",
      outcome: "failure",
      metadata: { changed, changedCount: changed.length },
    });
    return noStore({ error: "تعذر حفظ مفاتيح التشغيل" }, 500);
  }
}
