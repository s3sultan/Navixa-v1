import { NextResponse } from "next/server.js";
import { requireAdminPermission } from "../../../../worker/adminAccess.ts";
import { writeAdminActivity, type AdminActivityDatabase } from "../../../../worker/adminActivity.ts";
import { listEmergencyIncidents, readEmergencyState, setEmergencyState, type EmergencyDatabase } from "../../../../worker/emergencyMode.ts";
import { deliverEmergencyIncidentNotifications, type EmergencyNotificationEnv } from "../../../../worker/emergencyNotifications.ts";

type RuntimeDatabase = EmergencyDatabase & AdminActivityDatabase;
type RuntimeEnv = EmergencyNotificationEnv & { DB: RuntimeDatabase };

async function runtimeEnv(): Promise<Partial<RuntimeEnv>> {
  try { return (await import("cloudflare:workers") as { env?: Partial<RuntimeEnv> }).env || {}; }
  catch { return (globalThis as { __NAVIXA_EMERGENCY_ENV__?: Partial<RuntimeEnv> }).__NAVIXA_EMERGENCY_ENV__ || {}; }
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const identity = await requireAdminPermission(request, "emergency.manage");
  if (!identity) return noStore({ error: "غير مصرح" }, 401);
  const env = await runtimeEnv();
  if (!env.DB) return noStore({ error: "قاعدة بيانات NAVIXA غير متاحة" }, 503);
  try {
    const [state, incidents] = await Promise.all([readEmergencyState(env.DB), listEmergencyIncidents(env.DB, 20)]);
    return noStore({ ok: true, state, incidents, notificationsLive: true });
  } catch {
    return noStore({ error: "تعذر قراءة وضع الطوارئ" }, 500);
  }
}

export async function POST(request: Request) {
  const identity = await requireAdminPermission(request, "emergency.manage");
  if (!identity) return noStore({ error: "غير مصرح" }, 401);
  const env = await runtimeEnv();
  if (!env.DB) return noStore({ error: "قاعدة بيانات NAVIXA غير متاحة" }, 503);

  let body: { state?: string; reason?: string };
  try { body = await request.json() as { state?: string; reason?: string }; }
  catch { return noStore({ error: "طلب غير صالح" }, 400); }

  try {
    const state = await setEmergencyState(env.DB, {
      state: String(body.state || ""),
      reason: typeof body.reason === "string" ? body.reason : "",
      source: "admin-manual",
    });

    let notificationResult = { claimed: false, checked: 0, emailSent: 0, telegramSent: 0 };
    if ((state.state === "outage" || state.state === "recovery") && state.incident_id) {
      try {
        notificationResult = await deliverEmergencyIncidentNotifications(env as EmergencyNotificationEnv, {
          incidentId: state.incident_id,
          state: state.state,
        });
      } catch {
        // State changes must remain durable even if an external notification provider is temporarily unavailable.
      }
    }

    await writeAdminActivity(env.DB,{adminEmail:identity.email,action:"emergency_mode.update",resource:"emergency",metadata:{state:state.state,hasReason:Boolean(body.reason),notificationsClaimed:notificationResult.claimed,emailSent:notificationResult.emailSent,telegramSent:notificationResult.telegramSent}});
    return noStore({ ok: true, state, notifications: notificationResult });
  } catch (error) {
    await writeAdminActivity(env.DB,{adminEmail:identity.email,action:"emergency_mode.update",resource:"emergency",outcome:"failure",metadata:{requestedState:String(body.state||"").slice(0,40)}});
    if (error instanceof Error && error.message === "invalid_state") return noStore({ error: "حالة طوارئ غير صالحة" }, 400);
    if (error instanceof Error && error.message === "invalid_transition") return noStore({ error: "الانتقال بين حالتي الطوارئ غير مسموح" }, 409);
    return noStore({ error: "تعذر تحديث وضع الطوارئ" }, 500);
  }
}
