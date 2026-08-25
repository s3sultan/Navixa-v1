import { NextResponse } from "next/server.js";
import { isTrustedSameOriginRequest } from "../../../worker/adminAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; run: () => Promise<unknown> };
type D1Database = { prepare: (sql: string) => D1Statement };
const allowedPaths = new Set(["/", "/health", "/organize-your-day", "/meeting-summaries", "/smart-reminders", "/local-privacy"]);

async function db(): Promise<D1Database | null> {
  try {
    return (await import("cloudflare:workers") as { env?: { DB?: D1Database } }).env?.DB || null;
  } catch {
    return (globalThis as { DB?: D1Database }).DB || null;
  }
}

function boundedMilliseconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 120_000
    ? Math.round(value)
    : null;
}

function optionalMetric(value: unknown, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum ? Math.round(value) : null;
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const body = await request.json().catch(() => ({})) as { path?: unknown; ttfbMs?: unknown; loadMs?: unknown; lcpMs?: unknown; inpMs?: unknown; clsMilli?: unknown };
  const path = typeof body.path === "string" ? body.path : "";
  const ttfbMs = boundedMilliseconds(body.ttfbMs);
  const loadMs = boundedMilliseconds(body.loadMs);
  const lcpMs = optionalMetric(body.lcpMs, 120_000);
  const inpMs = optionalMetric(body.inpMs, 10_000);
  const clsMilli = optionalMetric(body.clsMilli, 10_000);
  if (!allowedPaths.has(path) || ttfbMs === null || loadMs === null) {
    return NextResponse.json({ error: "قياس أداء غير صالح" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const database = await db();
  if (!database) return NextResponse.json({ ok: true, stored: false }, { headers: { "Cache-Control": "no-store" } });

  await database.prepare(
    "INSERT INTO navixa_performance_samples (path,ttfb_ms,load_ms,lcp_ms,inp_ms,cls_milli,captured_at) VALUES (?,?,?,?,?,?,?)",
  ).bind(path, ttfbMs, loadMs, lcpMs, inpMs, clsMilli, new Date().toISOString()).run();

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
