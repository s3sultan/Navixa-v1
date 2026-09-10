import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter, isTrustedSameOriginRequest } from "../../../worker/adminAuth.ts";
import { readUserSessionToken, resolveUserSession } from "../../../worker/userAuth.ts";

type D1Result = { meta?: { changes?: number } };
type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  run: () => Promise<D1Result>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
};
type D1Database = { prepare: (sql: string) => D1Statement };
type SyncRow = { sync_key_hash: string; payload: string; updated_at: string };
type AccountSyncRow = { payload: string; updated_at: string; version: number };

const syncLimiter = createMemoryRateLimiter();
const syncIdPattern = /^[a-zA-Z0-9_-]{24,96}$/;
const syncKeyPattern = /^[a-zA-Z0-9_-]{32,160}$/;
const maxPayloadLength = 900_000;

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

function privateNoStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

function isValidId(value: unknown): value is string {
  return typeof value === "string" && syncIdPattern.test(value);
}

function isValidKey(value: unknown): value is string {
  return typeof value === "string" && syncKeyPattern.test(value);
}

function isValidPayload(value: unknown): value is string {
  return typeof value === "string" && value.length >= 2 && value.length <= maxPayloadLength;
}

function parseExpectedVersion(value: unknown) {
  if (value === undefined || value === null) return { valid: true as const, value: null };
  if (!Number.isInteger(value) || Number(value) < 1) return { valid: false as const, value: null };
  return { valid: true as const, value: Number(value) };
}

async function hashSyncKey(key: string) {
  const bytes = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureLegacySchema(db: D1Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS navixa_secure_sync (sync_id TEXT PRIMARY KEY, sync_key_hash TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
}

function requestAllowed(request: Request, requireSameOrigin = true) {
  // Mutations require an explicit same-origin request. Account reads are
  // protected by the opaque HttpOnly NAVIXA session cookie; legacy reads keep
  // their independent high-entropy sync key requirement.
  if (requireSameOrigin && !isTrustedSameOriginRequest(request)) return noStore({ error: "مصدر الطلب غير موثوق" }, 403);
  const limit = syncLimiter.consume(clientKey(request), 12, 60_000);
  if (!limit.allowed) return noStore({ error: "تجاوزت الحد المؤقت للمزامنة", retryAfterSeconds: limit.retryAfterSeconds }, 429);
  return null;
}

async function lookupLegacy(db: D1Database, syncId: string, syncKey: string) {
  const syncKeyHash = await hashSyncKey(syncKey);
  const result = await db.prepare("SELECT sync_key_hash,payload,updated_at FROM navixa_secure_sync WHERE sync_id=? AND sync_key_hash=?").bind(syncId, syncKeyHash).all<SyncRow>();
  return { syncKeyHash, row: result.results[0] || null };
}

async function resolveAccountMode(request: Request, db: D1Database) {
  const token = readUserSessionToken(request);
  if (!token) return { requested: false as const, session: null };
  const session = await resolveUserSession(request, db);
  return { requested: true as const, session };
}

async function readAccountSync(db: D1Database, userId: string) {
  const result = await db.prepare("SELECT payload,updated_at,version FROM navixa_account_sync WHERE user_id=? LIMIT 1").bind(userId).all<AccountSyncRow>();
  return result.results[0] || null;
}

export async function POST(request: Request) {
  const rejected = requestAllowed(request);
  if (rejected) return rejected;
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const payload = body.payload;
    if (!isValidPayload(payload)) return noStore({ error: "طلب المزامنة غير صالح" }, 400);

    const db = await getDb();
    if (!db) return noStore({ ok: false, configured: false }, 503);

    const account = await resolveAccountMode(request, db);
    if (account.requested) {
      if (!account.session) return privateNoStore({ error: "انتهت جلسة الحساب أو لم تعد صالحة" }, 401);
      const expected = parseExpectedVersion(body.expectedVersion);
      if (!expected.valid) return privateNoStore({ error: "إصدار المزامنة غير صالح" }, 400);

      const current = await readAccountSync(db, account.session.userId);
      if (expected.value !== null && expected.value !== current?.version) {
        return privateNoStore({ error: "توجد نسخة أحدث من بياناتك", conflict: true, currentVersion: current?.version || 0 }, 409);
      }

      const updatedAt = new Date().toISOString();
      if (current) {
        const result = await db.prepare("UPDATE navixa_account_sync SET payload=?,updated_at=?,version=version+1 WHERE user_id=? AND version=?")
          .bind(payload, updatedAt, account.session.userId, current.version).run();
        if ((result.meta?.changes || 0) !== 1) {
          const latest = await readAccountSync(db, account.session.userId);
          return privateNoStore({ error: "توجد نسخة أحدث من بياناتك", conflict: true, currentVersion: latest?.version || current.version }, 409);
        }
        return privateNoStore({ ok: true, mode: "account", version: current.version + 1, updatedAt });
      }

      const result = await db.prepare("INSERT OR IGNORE INTO navixa_account_sync(user_id,payload,version,updated_at) VALUES(?,?,1,?)")
        .bind(account.session.userId, payload, updatedAt).run();
      if ((result.meta?.changes || 0) !== 1) {
        const latest = await readAccountSync(db, account.session.userId);
        return privateNoStore({ error: "توجد نسخة أحدث من بياناتك", conflict: true, currentVersion: latest?.version || 1 }, 409);
      }
      return privateNoStore({ ok: true, mode: "account", version: 1, updatedAt });
    }

    const syncId = body.syncId;
    const syncKey = body.syncKey;
    if (!isValidId(syncId) || !isValidKey(syncKey)) return noStore({ error: "طلب المزامنة غير صالح" }, 400);
    await ensureLegacySchema(db);
    const { syncKeyHash, row } = await lookupLegacy(db, syncId, syncKey);
    const exists = await db.prepare("SELECT sync_id FROM navixa_secure_sync WHERE sync_id=?").bind(syncId).all<{ sync_id: string }>();
    if (exists.results[0] && !row) return noStore({ error: "تعذر الوصول إلى مزامنة الطلب" }, 404);
    const updatedAt = new Date().toISOString();
    await db.prepare("INSERT INTO navixa_secure_sync(sync_id,sync_key_hash,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(sync_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at")
      .bind(syncId, syncKeyHash, payload, updatedAt).run();
    return noStore({ ok: true, mode: "legacy", updatedAt });
  } catch {
    return noStore({ error: "تعذر حفظ المزامنة" }, 500);
  }
}

export async function GET(request: Request) {
  const rejected = requestAllowed(request, false);
  if (rejected) return rejected;
  try {
    const db = await getDb();
    if (!db) return noStore({ ok: false, configured: false }, 503);

    const account = await resolveAccountMode(request, db);
    if (account.requested) {
      if (!account.session) return privateNoStore({ error: "انتهت جلسة الحساب أو لم تعد صالحة" }, 401);
      const row = await readAccountSync(db, account.session.userId);
      return privateNoStore({ ok: true, mode: "account", found: Boolean(row), payload: row?.payload || null, version: row?.version || 0, updatedAt: row?.updated_at || null });
    }

    const url = new URL(request.url);
    const syncId = url.searchParams.get("syncId");
    const syncKey = request.headers.get("x-navixa-sync-key");
    if (!isValidId(syncId) || !isValidKey(syncKey)) return noStore({ error: "طلب المزامنة غير صالح" }, 400);
    await ensureLegacySchema(db);
    const { row } = await lookupLegacy(db, syncId, syncKey);
    return noStore({ ok: true, mode: "legacy", found: Boolean(row), payload: row?.payload || null, updatedAt: row?.updated_at || null });
  } catch {
    return noStore({ error: "تعذر قراءة المزامنة" }, 500);
  }
}

export async function DELETE(request: Request) {
  const rejected = requestAllowed(request);
  if (rejected) return rejected;
  try {
    const db = await getDb();
    if (!db) return noStore({ ok: false, configured: false }, 503);

    const account = await resolveAccountMode(request, db);
    if (account.requested) {
      if (!account.session) return privateNoStore({ error: "انتهت جلسة الحساب أو لم تعد صالحة" }, 401);
      const result = await db.prepare("DELETE FROM navixa_account_sync WHERE user_id=?").bind(account.session.userId).run();
      return privateNoStore({ ok: true, mode: "account", found: (result.meta?.changes || 0) > 0 });
    }

    const url = new URL(request.url);
    const syncId = url.searchParams.get("syncId");
    const syncKey = request.headers.get("x-navixa-sync-key");
    if (!isValidId(syncId) || !isValidKey(syncKey)) return noStore({ error: "طلب المزامنة غير صالح" }, 400);
    await ensureLegacySchema(db);
    const { row } = await lookupLegacy(db, syncId, syncKey);
    if (!row) return noStore({ ok: true, mode: "legacy", found: false });
    await db.prepare("DELETE FROM navixa_secure_sync WHERE sync_id=? AND sync_key_hash=?").bind(syncId, await hashSyncKey(syncKey)).run();
    return noStore({ ok: true, mode: "legacy", found: true });
  } catch {
    return noStore({ error: "تعذر حذف المزامنة" }, 500);
  }
}
