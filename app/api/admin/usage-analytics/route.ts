import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";
import { ensureUsageAnalyticsSchema, readUsageAnalyticsSettings, saveUsageAnalyticsSettings, type UsageAnalyticsDatabase, type UsageAnalyticsSettings } from "../../../../worker/usageAnalytics.ts";

type Statement = { bind: (...values: unknown[]) => Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type Db = UsageAnalyticsDatabase & { prepare: (sql: string) => Statement };
type Alert = { alert_key: string; observed_count: number; window_start: string; status: string; email_sent: number; telegram_sent: number; sent_at: string; created_at: string };
const retentionChoices = new Set([7, 14, 30, 60, 90]);
async function db(): Promise<Db | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Db } }).env?.DB || null; } catch { return (globalThis as { DB?: Db }).DB || null; } }
async function allowed(request: Request, mutation = false) { const secret = await resolveAdminJwtSecret(); return Boolean(secret && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret) && (!mutation || isTrustedSameOriginRequest(request))); }

export async function GET(request: Request) {
  if (!await allowed(request)) return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const database = await db(); if (!database) return NextResponse.json({ error: "التخزين غير مهيأ" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  await ensureUsageAnalyticsSchema(database); const settings = await readUsageAnalyticsSettings(database); const cutoff = new Date(Date.now() - settings.retentionDays * 24 * 60 * 60_000).toISOString();
  const [summary, accounts, features, heatmap, alerts] = await Promise.all([
    database.prepare("SELECT (SELECT COUNT(*) FROM navixa_users) AS accounts,(SELECT COUNT(*) FROM navixa_user_sessions) AS logins,(SELECT COALESCE(SUM(duration_seconds),0) FROM navixa_usage_events WHERE event_type='engagement' AND created_at>=?) AS seconds").bind(cutoff).all<{ accounts: number; logins: number; seconds: number }>(),
    database.prepare("SELECT u.email,COUNT(DISTINCT s.id) AS login_count,COALESCE(SUM(e.duration_seconds),0) AS duration_seconds,u.last_login_at FROM navixa_users u LEFT JOIN navixa_user_sessions s ON s.user_id=u.id LEFT JOIN navixa_usage_events e ON e.user_id=u.id AND e.created_at>=? GROUP BY u.id,u.email,u.last_login_at ORDER BY u.last_login_at DESC LIMIT 50").bind(cutoff).all<{ email: string; login_count: number; duration_seconds: number; last_login_at: string }>(),
    database.prepare("SELECT path,COUNT(*) AS uses,COALESCE(SUM(duration_seconds),0) AS seconds FROM navixa_usage_events WHERE created_at>=? AND event_type='view' GROUP BY path ORDER BY uses DESC LIMIT 5").bind(cutoff).all<{ path: string; uses: number; seconds: number }>(),
    database.prepare("SELECT grid_x,grid_y,COUNT(*) AS uses FROM navixa_usage_events WHERE event_type='tap' AND created_at>=? GROUP BY grid_x,grid_y ORDER BY uses DESC").bind(cutoff).all<{ grid_x: number; grid_y: number; uses: number }>(),
    database.prepare("SELECT alert_key,observed_count,window_start,status,email_sent,telegram_sent,sent_at,created_at FROM navixa_usage_analytics_alerts ORDER BY created_at DESC LIMIT 8").all<Alert>(),
  ]);
  const row = summary.results[0] || { accounts: 0, logins: 0, seconds: 0 };
  return NextResponse.json({ summary: { accounts: Number(row.accounts), logins: Number(row.logins), minutes: Math.round(Number(row.seconds) / 60) }, accounts: accounts.results, features: features.results, heatmap: heatmap.results, settings, alerts: alerts.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await allowed(request, true)) return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const database = await db(); if (!database) return NextResponse.json({ error: "التخزين غير مهيأ" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const body = await request.json().catch(() => ({})) as { retentionDays?: unknown; alertsEnabled?: unknown };
  const retentionDays = Number(body.retentionDays); if (!retentionChoices.has(retentionDays)) return NextResponse.json({ error: "اختر مدة احتفاظ معتمدة" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  await saveUsageAnalyticsSettings(database, { retentionDays: retentionDays as UsageAnalyticsSettings["retentionDays"], alertsEnabled: body.alertsEnabled !== false });
  return NextResponse.json({ ok: true, message: "تم حفظ إعدادات تحليلات الاستخدام" }, { headers: { "Cache-Control": "no-store" } });
}
