import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter } from "../../../../worker/adminAuth.ts";
import {
  refreshUserSessionIfNeeded,
  resolveUserSession,
  trustedUserMutation,
  type D1Database,
  type UserSession,
} from "../../../../worker/userAuth.ts";

type D1Result = { meta?: { changes?: number } };
type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  run: () => Promise<D1Result>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
};
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type WorkerBinding = { env?: { DB?: Database } };
type SyncRow = { version: number; payload: string; updated_at: string };

const MAX_PAYLOAD_LENGTH = 650_000;
const accountSyncLimiter = createMemoryRateLimiter();

async function database(): Promise<Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: Database }).DB || null; }
}

function clientKey(request: Request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function headers(sessionCookie?: string | null) {
  const value: Record<string, string> = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
  if (sessionCookie) value["Set-Cookie"] = sessionCookie;
  return value;
}

function json(body: Record<string, unknown>, status = 200, sessionCookie?: string | null) {
  return NextResponse.json(body, { status, headers: headers(sessionCookie) });
}

function rateLimit(request: Request) {
  const limit = accountSyncLimiter.consume(clientKey(request), 30, 60_000);
  return limit.allowed ? null : json({ ok: false, error: "تجاوزت الحد المؤقت للمزامنة", retryAfterSeconds: limit.retryAfterSeconds }, 429);
}

async function authenticated(request: Request, db: Database): Promise<{ session: UserSession; cookie: string | null } | null> {
  const session = await resolveUserSession(request, db);
  if (!session) return null;
  return refreshUserSessionIfNeeded(request, db, session).catch(() => ({ session, cookie: null }));
}

function validExpectedVersion(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= Number.MAX_SAFE_INTEGER;
}

export async function GET(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;
  const db = await database();
  if (!db) return json({ ok: false, configured: false }, 503);

  try {
    const auth = await authenticated(request, db);
    if (!auth) return json({ ok: false, error: "يلزم تسجيل الدخول" }, 401);
    const result = await db.prepare("SELECT version,payload,updated_at FROM navixa_user_sync WHERE user_id=? LIMIT 1")
      .bind(auth.session.userId).all<SyncRow>();
    const row = result.results[0] || null;
    return json({
      ok: true,
      found: Boolean(row),
      version: row?.version || 0,
      payload: row?.payload || null,
      updatedAt: row?.updated_at || null,
    }, 200, auth.cookie);
  } catch {
    return json({ ok: false, error: "تعذر قراءة مزامنة الحساب" }, 500);
  }
}

export async function PUT(request: Request) {
  if (!trustedUserMutation(request)) return json({ ok: false, error: "مصدر الطلب غير موثوق" }, 403);
  const limited = rateLimit(request);
  if (limited) return limited;
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_PAYLOAD_LENGTH + 20_000) return json({ ok: false, error: "حجم المزامنة أكبر من المسموح" }, 413);

  const db = await database();
  if (!db) return json({ ok: false, configured: false }, 503);

  try {
    const auth = await authenticated(request, db);
    if (!auth) return json({ ok: false, error: "يلزم تسجيل الدخول" }, 401);
    const body = await request.json().catch(() => null) as { payload?: unknown; expectedVersion?: unknown } | null;
    const payload = typeof body?.payload === "string" ? body.payload : "";
    const expectedVersion = body?.expectedVersion;
    if (!payload || payload.length > MAX_PAYLOAD_LENGTH || !validExpectedVersion(expectedVersion)) {
      return json({ ok: false, error: "طلب المزامنة غير صالح" }, payload.length > MAX_PAYLOAD_LENGTH ? 413 : 400, auth.cookie);
    }

    const currentResult = await db.prepare("SELECT version FROM navixa_user_sync WHERE user_id=? LIMIT 1")
      .bind(auth.session.userId).all<{ version: number }>();
    const currentVersion = currentResult.results[0]?.version || 0;
    if (currentVersion !== expectedVersion) {
      return json({ ok: false, conflict: true, currentVersion }, 409, auth.cookie);
    }

    const updatedAt = new Date().toISOString();
    if (currentVersion === 0) {
      try {
        await db.prepare("INSERT INTO navixa_user_sync(user_id,version,payload,updated_at) VALUES(?,1,?,?)")
          .bind(auth.session.userId, payload, updatedAt).run();
        return json({ ok: true, version: 1, updatedAt }, 200, auth.cookie);
      } catch {
        const latest = await db.prepare("SELECT version FROM navixa_user_sync WHERE user_id=? LIMIT 1")
          .bind(auth.session.userId).all<{ version: number }>();
        return json({ ok: false, conflict: true, currentVersion: latest.results[0]?.version || 0 }, 409, auth.cookie);
      }
    }

    const result = await db.prepare("UPDATE navixa_user_sync SET payload=?,version=version+1,updated_at=? WHERE user_id=? AND version=?")
      .bind(payload, updatedAt, auth.session.userId, currentVersion).run();
    if (result?.meta?.changes === 0) {
      const latest = await db.prepare("SELECT version FROM navixa_user_sync WHERE user_id=? LIMIT 1")
        .bind(auth.session.userId).all<{ version: number }>();
      return json({ ok: false, conflict: true, currentVersion: latest.results[0]?.version || currentVersion }, 409, auth.cookie);
    }
    return json({ ok: true, version: currentVersion + 1, updatedAt }, 200, auth.cookie);
  } catch {
    return json({ ok: false, error: "تعذر حفظ مزامنة الحساب" }, 500);
  }
}
