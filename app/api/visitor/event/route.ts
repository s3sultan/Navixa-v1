import { NextResponse } from "next/server.js";
import { isTrustedSameOriginRequest } from "../../../../worker/adminAuth.ts";

type Statement = { bind: (...values: unknown[]) => Statement; run: () => Promise<unknown>; first: <T = Record<string, unknown>>() => Promise<T | null> };
type Db = { prepare: (sql: string) => Statement };
async function db(): Promise<Db | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Db } }).env?.DB || null; } catch { return (globalThis as { DB?: Db }).DB || null; } }
const cleanPath = (value: unknown) => typeof value === "string" && value.startsWith("/") && value.length <= 160 && !value.startsWith("/admin") && !value.startsWith("/api") ? value.split("?")[0] : "";
async function ensureSchema(database: Db) {
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_public_pageviews (id TEXT PRIMARY KEY,path TEXT NOT NULL,created_at TEXT NOT NULL)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_public_pageviews_created ON navixa_public_pageviews(created_at)").run();
}

export async function GET() {
  const database = await db();
  if (!database) return NextResponse.json({ visitors: 0 }, { headers: { "Cache-Control": "no-store" } });
  await ensureSchema(database);
  const row = await database.prepare("SELECT COUNT(*) AS visitors FROM navixa_public_pageviews").first<{ visitors?: number }>();
  return NextResponse.json({ visitors: Number(row?.visitors || 0) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return NextResponse.json({ error: "مصدر غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json({ ok: true, ignored: "storage_unavailable" }, { headers: { "Cache-Control": "no-store" } });
  const body = await request.json().catch(() => ({})) as { path?: unknown };
  const path = cleanPath(body.path);
  if (!path) return NextResponse.json({ error: "مسار غير صالح" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  await ensureSchema(database);
  await database.prepare("INSERT INTO navixa_public_pageviews(id,path,created_at) VALUES (?,?,?)").bind(crypto.randomUUID(), path, new Date().toISOString()).run();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
