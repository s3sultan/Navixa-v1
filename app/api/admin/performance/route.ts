import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

type Statement = { bind: (...values: unknown[]) => Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type Db = { prepare: (sql: string) => Statement };
async function db(): Promise<Db | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Db } }).env?.DB || null; } catch { return (globalThis as { DB?: Db }).DB || null; } }
async function allowed(request: Request) { const secret = await resolveAdminJwtSecret(); return Boolean(secret && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret)); }

const summarySql = "SELECT path,SUM(sample_count) AS samples,ROUND(SUM(avg_ttfb_ms*sample_count)*1.0/SUM(sample_count)) AS avg_ttfb_ms,ROUND(SUM(avg_load_ms*sample_count)*1.0/SUM(sample_count)) AS avg_load_ms,MAX(p95_load_ms) AS p95_load_ms,ROUND(SUM(COALESCE(avg_lcp_ms,0)*sample_count)*1.0/SUM(sample_count)) AS avg_lcp_ms,MAX(p95_lcp_ms) AS p95_lcp_ms,ROUND(SUM(COALESCE(avg_inp_ms,0)*sample_count)*1.0/SUM(sample_count)) AS avg_inp_ms,MAX(p95_inp_ms) AS p95_inp_ms,ROUND(SUM(COALESCE(avg_cls_milli,0)*sample_count)*1.0/SUM(sample_count)) AS avg_cls_milli FROM navixa_performance_windows WHERE bucket_start>=? AND bucket_start<? GROUP BY path ORDER BY path";

export async function GET(request: Request) {
  if (!await allowed(request)) return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const database = await db(); if (!database) return NextResponse.json({ error: "التخزين غير مهيأ" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const now = Date.now(), currentStart = new Date(now - 7 * 24 * 60 * 60_000).toISOString(), previousStart = new Date(now - 14 * 24 * 60 * 60_000).toISOString(), end = new Date(now).toISOString();
  const [current, previous] = await Promise.all([database.prepare(summarySql).bind(currentStart, end).all(), database.prepare(summarySql).bind(previousStart, currentStart).all()]);
  return NextResponse.json({ current: current.results, previous: previous.results, evidence: { minimumSamples: 10, currentStart, end } }, { headers: { "Cache-Control": "no-store" } });
}
