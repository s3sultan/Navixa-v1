import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";
import { listEmergencyIncidents, readEmergencyState, setEmergencyState, type EmergencyDatabase } from "../../../../worker/emergencyMode.ts";
import { deliverEmergencyIncidentNotifications, type EmergencyNotificationEnv } from "../../../../worker/emergencyNotifications.ts";

type RuntimeEnv = EmergencyNotificationEnv & { DB: EmergencyDatabase };

async function runtimeEnv(): Promise<Partial<RuntimeEnv>> {
  try { return (await import("cloudflare:workers") as { env?: Partial<RuntimeEnv> }).env || {}; }
  catch { return (globalThis as { __NAVIXA_EMERGENCY_ENV__?: Partial<RuntimeEnv> }).__NAVIXA_EMERGENCY_ENV__ || {}; }
}

async function adminAllowed(request: Request, requireSameOrigin = false) {
  const secret = await resolveAdminJwtSecret();
  if (!secret) return false;
  if (requireSameOrigin && !isTrustedSameOriginRequest(request)) return false;
  return verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret);
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!await adminAllowed(request)) return noStore({ error: "غير مصرح" }, 401);
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
  if (!await adminAllowed(request, true)) return noStore({ error: "غير مصرح" }, 401);
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

    return noStore({ ok: true, state, notifications: notificationResult });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_state") return noStore({ error: "حالة طوارئ غير صالحة" }, 400);
    if (error instanceof Error && error.message === "invalid_transition") return noStore({ error: "الانتقال بين حالتي الطوارئ غير مسموح" }, 409);
    return noStore({ error: "تعذر تحديث وضع الطوارئ" }, 500);
  }
}
