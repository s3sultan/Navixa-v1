import { NextResponse } from "next/server";
import { isRuntimeFeatureEnabled } from "../../runtimeFeatures.ts";

type D1Result = { meta?: { changes?: number } };
type D1Statement = { bind: (...values: unknown[]) => D1Statement; run: () => Promise<D1Result>; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> };
type D1Database = { prepare: (sql: string) => D1Statement };
type Stats = { visits: number; ehsan: number };

const STATS_CACHE_CONTROL = "public, max-age=0, s-maxage=30, stale-while-revalidate=300";
const NO_STORE = "no-store";

const getDb = async (): Promise<D1Database | null> => {
  let bound = null;
  try { bound = (await import("cloudflare:workers") as any).env?.DB || null; } catch {}
  const runtime = (globalThis as any).DB;
  const processEnv = typeof process !== "undefined" ? (process as any).env?.DB : null;
  return bound || runtime || processEnv || null;
};

const safeDay = () => new Date().toISOString().slice(0, 10);

async function ensureSchema(db: D1Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS navixa_counters (key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS navixa_counter_events (event_key TEXT PRIMARY KEY, event_name TEXT NOT NULL, visitor_key TEXT NOT NULL, event_day TEXT NOT NULL, created_at TEXT NOT NULL)").run();
  const now = new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO navixa_counters (key,value,updated_at) VALUES ('site_visits',12840,?),('ehsan_clicks',1200,?)").bind(now, now).run();
}

async function readStats(db: D1Database): Promise<Stats> {
  const result = await db.prepare("SELECT key,value FROM navixa_counters WHERE key IN ('site_visits','ehsan_clicks')").all<{ key: string; value: number }>();
  const values = Object.fromEntries(result.results.map(row => [row.key, Number(row.value) || 0]));
  return { visits: values.site_visits || 0, ehsan: values.ehsan_clicks || 0 };
}

function statsResponse(payload: { ok: boolean; configured: boolean; stats: Stats }, cacheControl = STATS_CACHE_CONTROL) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": cacheControl,
      "X-NAVIXA-Stats-Cache": cacheControl === STATS_CACHE_CONTROL ? "EDGE-30S" : "BYPASS",
    },
  });
}

export async function GET() {
  try {
    const db = await getDb();
    if (!db) return statsResponse({ ok: false, configured: false, stats: { visits: 0, ehsan: 0 } }, NO_STORE);
    if (!await isRuntimeFeatureEnabled(db, "public_counter_enabled")) return statsResponse({ ok: true, configured: false, stats: { visits: 0, ehsan: 0 } }, NO_STORE);
    // This public read runs frequently. Schema creation stays on the mutation path
    // so a cached counter read never performs DDL against D1.
    return statsResponse({ ok: true, configured: true, stats: await readStats(db) });
  } catch {
    return statsResponse({ ok: false, configured: false, stats: { visits: 0, ehsan: 0 } }, NO_STORE);
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ ok: false, configured: false }, { status: 503, headers: { "Cache-Control": NO_STORE } });
    if (!await isRuntimeFeatureEnabled(db, "public_counter_enabled")) return statsResponse({ ok: true, configured: false, stats: { visits: 0, ehsan: 0 } }, NO_STORE);
    const body = await request.json().catch(() => ({}));
    const event = body?.event === "ehsan" ? "ehsan" : body?.event === "visit" ? "visit" : null;
    const visitorKey = typeof body?.visitorKey === "string" ? body.visitorKey.slice(0, 120) : "";
    if (!event || visitorKey.length < 12) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400, headers: { "Cache-Control": NO_STORE } });

    await ensureSchema(db);
    const day = safeDay();
    const eventKey = `${event}:${day}:${visitorKey}`;
    const inserted = await db.prepare("INSERT OR IGNORE INTO navixa_counter_events (event_key,event_name,visitor_key,event_day,created_at) VALUES (?,?,?,?,?)").bind(eventKey, event, visitorKey, day, new Date().toISOString()).run();
    if (Number(inserted.meta?.changes || 0) > 0) {
      const counter = event === "visit" ? "site_visits" : "ehsan_clicks";
      await db.prepare("UPDATE navixa_counters SET value=value+1,updated_at=? WHERE key=?").bind(new Date().toISOString(), counter).run();
    }
    return statsResponse({ ok: true, configured: true, stats: await readStats(db) }, NO_STORE);
  } catch {
    return NextResponse.json({ error: "تعذر تحديث الإحصائية" }, { status: 500, headers: { "Cache-Control": NO_STORE } });
  }
}
