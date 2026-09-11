import { NextResponse } from "next/server";

type D1Statement = { all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type D1Database = { prepare: (sql: string) => D1Statement };

async function getDb(): Promise<D1Database | null> {
  let bound = null;
  try { bound = (await import("cloudflare:workers") as any).env?.DB || null; } catch {}
  const runtime = (globalThis as any).DB;
  const processEnv = typeof process !== "undefined" ? (process as any).env?.DB : null;
  return bound || runtime || processEnv || null;
}

const headers = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function GET() {
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ ok: false, service: "navixa-primary" }, { status: 503, headers });
    const result = await db.prepare("SELECT 1 AS ok").all<{ ok: number }>();
    if (Number(result.results[0]?.ok) !== 1) return NextResponse.json({ ok: false, service: "navixa-primary" }, { status: 503, headers });
    return NextResponse.json({ ok: true, service: "navixa-primary" }, { headers });
  } catch {
    return NextResponse.json({ ok: false, service: "navixa-primary" }, { status: 503, headers });
  }
}
