import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";
import { ensureSiteHealthSchema, type SiteHealthDatabase } from "../../../../worker/siteHealth.ts";

type Statement = { bind: (...values: unknown[]) => Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type Db = SiteHealthDatabase & { prepare: (sql: string) => Statement };
async function db(): Promise<Db | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Db } }).env?.DB || null; } catch { return (globalThis as { DB?: Db }).DB || null; } }
async function allowed(request: Request) { const secret = await resolveAdminJwtSecret(); return Boolean(secret && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret)); }

export async function GET(request: Request) {
  if (!await allowed(request)) return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const database = await db(); if (!database) return NextResponse.json({ error: "التخزين غير مهيأ" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  await ensureSiteHealthSchema(database);
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const [reports, csp] = await Promise.all([
    database.prepare("SELECT week_start,status,checks_json,alerted_at,email_sent,telegram_sent,created_at FROM navixa_weekly_site_health ORDER BY week_start DESC LIMIT 8").all(),
    database.prepare("SELECT bucket_day,directive,blocked_host,report_count,first_seen_at,last_seen_at FROM navixa_csp_report_summaries WHERE bucket_day>=? ORDER BY last_seen_at DESC LIMIT 40").bind(cutoff).all(),
  ]);
  return NextResponse.json({ reports: reports.results, csp: csp.results }, { headers: { "Cache-Control": "no-store" } });
}
