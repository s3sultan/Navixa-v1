import { NextResponse } from "next/server.js";
import { isTrustedSameOriginRequest } from "../../../worker/adminAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; run: () => Promise<unknown> };
type D1Database = { prepare: (sql: string) => D1Statement };
const allowedPaths = new Set(["/", "/health"]);

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

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const body = await request.json().catch(() => ({})) as { path?: unknown; ttfbMs?: unknown; loadMs?: unknown };
  const path = typeof body.path === "string" ? body.path : "";
  const ttfbMs = boundedMilliseconds(body.ttfbMs);
  const loadMs = boundedMilliseconds(body.loadMs);
  if (!allowedPaths.has(path) || ttfbMs === null || loadMs === null) {
    return NextResponse.json({ error: "قياس أداء غير صالح" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const database = await db();
  if (!database) return NextResponse.json({ ok: true, stored: false }, { headers: { "Cache-Control": "no-store" } });

  await database.prepare(
    "INSERT INTO navixa_performance_samples (path,ttfb_ms,load_ms,captured_at) VALUES (?,?,?,?)",
  ).bind(path, ttfbMs, loadMs, new Date().toISOString()).run();

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
