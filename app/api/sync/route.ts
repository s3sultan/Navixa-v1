import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter, isTrustedSameOriginRequest } from "../../../worker/adminAuth.ts";

type D1Result = { meta?: { changes?: number } };
type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  run: () => Promise<D1Result>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
};
type D1Database = { prepare: (sql: string) => D1Statement };
type SyncRow = { sync_key_hash: string; payload: string; updated_at: string };

const syncLimiter = createMemoryRateLimiter();
const syncIdPattern = /^[a-zA-Z0-9_-]{24,96}$/;
const syncKeyPattern = /^[a-zA-Z0-9_-]{32,160}$/;

const getDb = async (): Promise<D1Database | null> => {
  let bound = null;
  try { bound = (await import("cloudflare:workers") as any).env?.DB || null; } catch {}
  return bound || (globalThis as any).DB || ((typeof process !== "undefined" ? (process as any).env?.DB : null) || null);
};

function clientKey(request: Request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isValidId(value: unknown): value is string {
  return typeof value === "string" && syncIdPattern.test(value);
}

function isValidKey(value: unknown): value is string {
  return typeof value === "string" && syncKeyPattern.test(value);
}

async function hashSyncKey(key: string) {
  const bytes = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureSchema(db: D1Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS navixa_secure_sync (sync_id TEXT PRIMARY KEY, sync_key_hash TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
}

function requestAllowed(request: Request, requireSameOrigin = true) {
  // Writes require an explicit same-origin request. Reads are protected by a
  // separate high-entropy sync key sent as a non-simple request header.
  if (requireSameOrigin && !isTrustedSameOriginRequest(request)) return noStore({ error: "مصدر الطلب غير موثوق" }, 403);
  const limit = syncLimiter.consume(clientKey(request), 12, 60_000);
  if (!limit.allowed) return noStore({ error: "تجاوزت الحد المؤقت للمزامنة", retryAfterSeconds: limit.retryAfterSeconds }, 429);
  return null;
}

async function lookup(db: D1Database, syncId: string, syncKey: string) {
  const syncKeyHash = await hashSyncKey(syncKey);
  const result = await db.prepare("SELECT sync_key_hash,payload,updated_at FROM navixa_secure_sync WHERE sync_id=? AND sync_key_hash=?").bind(syncId, syncKeyHash).all<SyncRow>();
  return { syncKeyHash, row: result.results[0] || null };
}

export async function POST(request: Request) {
  const rejected = requestAllowed(request);
  if (rejected) return rejected;
  try {
    const body = await request.json().catch(() => ({}));
    const syncId = body?.syncId;
    const syncKey = body?.syncKey;
    const payload = typeof body?.payload === "string" ? body.payload : "";
    if (!isValidId(syncId) || !isValidKey(syncKey) || payload.length < 2 || payload.length > 900_000) return noStore({ error: "طلب المزامنة غير صالح" }, 400);
    const db = await getDb();
    if (!db) return noStore({ ok: false, configured: false }, 503);
    await ensureSchema(db);
    const { syncKeyHash, row } = await lookup(db, syncId, syncKey);
    const exists = await db.prepare("SELECT sync_id FROM navixa_secure_sync WHERE sync_id=?").bind(syncId).all<{ sync_id: string }>();
    if (exists.results[0] && !row) return noStore({ error: "تعذر الوصول إلى مزامنة الطلب" }, 404);
    const updatedAt = new Date().toISOString();
    await db.prepare("INSERT INTO navixa_secure_sync(sync_id,sync_key_hash,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(sync_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at").bind(syncId, syncKeyHash, payload, updatedAt).run();
    return noStore({ ok: true, updatedAt });
  } catch {
    return noStore({ error: "تعذر حفظ المزامنة" }, 500);
  }
}

export async function GET(request: Request) {
  const rejected = requestAllowed(request, false);
  if (rejected) return rejected;
  try {
    const url = new URL(request.url);
    const syncId = url.searchParams.get("syncId");
    const syncKey = request.headers.get("x-navixa-sync-key");
    if (!isValidId(syncId) || !isValidKey(syncKey)) return noStore({ error: "طلب المزامنة غير صالح" }, 400);
    const db = await getDb();
    if (!db) return noStore({ ok: false, configured: false }, 503);
    await ensureSchema(db);
    const { row } = await lookup(db, syncId, syncKey);
    return noStore({ ok: true, found: Boolean(row), payload: row?.payload || null, updatedAt: row?.updated_at || null });
  } catch {
    return noStore({ error: "تعذر قراءة المزامنة" }, 500);
  }
}

export async function DELETE(request: Request) {
  const rejected = requestAllowed(request);
  if (rejected) return rejected;
  try {
    const url = new URL(request.url);
    const syncId = url.searchParams.get("syncId");
    const syncKey = request.headers.get("x-navixa-sync-key");
    if (!isValidId(syncId) || !isValidKey(syncKey)) return noStore({ error: "طلب المزامنة غير صالح" }, 400);
    const db = await getDb();
    if (!db) return noStore({ ok: false, configured: false }, 503);
    await ensureSchema(db);
    const { row } = await lookup(db, syncId, syncKey);
    if (!row) return noStore({ ok: true, found: false });
    await db.prepare("DELETE FROM navixa_secure_sync WHERE sync_id=? AND sync_key_hash=?").bind(syncId, await hashSyncKey(syncKey)).run();
    return noStore({ ok: true, found: true });
  } catch {
    return noStore({ error: "تعذر حذف المزامنة" }, 500);
  }
}
