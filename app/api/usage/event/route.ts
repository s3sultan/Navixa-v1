import { NextResponse } from "next/server.js";
import { resolveUserSession, trustedUserMutation, type D1Database } from "../../../../worker/userAuth.ts";
import { ensureUsageAnalyticsSchema } from "../../../../worker/usageAnalytics.ts";
import { isRuntimeFeatureEnabled } from "../../../runtimeFeatures.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
const paths = new Set(["/","/today","/worship","/health","/meetings"]);
const events = new Set(["view","engagement","tap"]);
async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const database = await db(); if (!database) return NextResponse.json({ error: "التخزين غير مهيأ" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!await isRuntimeFeatureEnabled(database, "usage_analytics_enabled")) return NextResponse.json({ ok: true, ignored: "analytics_disabled" }, { headers: { "Cache-Control": "no-store" } });
  const session = await resolveUserSession(request, database); if (!session) return NextResponse.json({ error: "سجّل دخولك أولًا" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const body = await request.json().catch(() => ({})) as { path?: unknown; event?: unknown; x?: unknown; y?: unknown; durationSeconds?: unknown };
  const path = typeof body.path === "string" && paths.has(body.path) ? body.path : "";
  const event = typeof body.event === "string" && events.has(body.event) ? body.event : "";
  const x = Number.isInteger(body.x) && Number(body.x) >= 0 && Number(body.x) < 8 ? Number(body.x) : -1;
  const y = Number.isInteger(body.y) && Number(body.y) >= 0 && Number(body.y) < 12 ? Number(body.y) : -1;
  const duration = Number.isInteger(body.durationSeconds) && Number(body.durationSeconds) >= 0 && Number(body.durationSeconds) <= 3600 ? Number(body.durationSeconds) : 0;
  if (!path || !event || (event === "tap" && (x < 0 || y < 0))) return NextResponse.json({ error: "بيانات استخدام غير صالحة" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  await ensureUsageAnalyticsSchema(database);
  await database.prepare("INSERT INTO navixa_usage_events(id,user_id,path,event_type,grid_x,grid_y,duration_seconds,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), session.userId, path, event, x, y, duration, new Date().toISOString()).run();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
