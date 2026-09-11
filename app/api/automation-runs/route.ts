import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter, isTrustedSameOriginRequest } from "../../../worker/adminAuth.ts";
import { readUserSessionToken, resolveUserSession, type D1Database } from "../../../worker/userAuth.ts";

const limiter = createMemoryRateLimiter();
const tokenPattern = /^[A-Za-z0-9._:-]{1,120}$/;
const statuses = new Set(["queued", "running", "succeeded", "failed", "skipped", "cancelled"]);
const triggerTypes = new Set(["manual", "schedule", "event"]);
const sources = new Set(["", "transcription", "manual", "test"]);

type PersistedRunRow = {
  id: string;
  automation_id: string;
  automation_name: string;
  skill_id: string;
  trigger_type: "manual" | "schedule" | "event";
  trigger_value: string;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";
  started_at: string;
  completed_at: string;
  session_ref: string;
  part_ref: string;
  source: string;
};

const forbiddenPayloadKeys = new Set([
  "input",
  "output",
  "error",
  "transcript",
  "summary",
  "metadata",
  "credentials",
  "stack",
]);

async function getDb(): Promise<D1Database | null> {
  let bound = null;
  try { bound = (await import("cloudflare:workers") as any).env?.DB || null; } catch {}
  return bound || (globalThis as any).DB || ((typeof process !== "undefined" ? (process as any).env?.DB : null) || null);
}

function privateNoStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

function clientKey(request: Request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function rateLimit(request: Request) {
  const limit = limiter.consume(clientKey(request), 60, 60_000);
  return limit.allowed ? null : privateNoStore({ error: "تجاوزت الحد المؤقت لسجل التشغيل", retryAfterSeconds: limit.retryAfterSeconds }, 429);
}

function token(value: unknown, max = 120) {
  return typeof value === "string" && value.length <= max && tokenPattern.test(value) ? value : null;
}

function text(value: unknown, max = 160) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) return null;
  return normalized;
}

function optionalToken(value: unknown) {
  if (value == null || value === "") return "";
  return token(value);
}

function isoDate(value: unknown, optional = false) {
  if (optional && (value == null || value === "")) return "";
  if (typeof value !== "string" || value.length > 40 || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function triggerValue(type: string, value: unknown) {
  if (type === "manual") return "";
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 || /[\u0000-\u001F\u007F]/.test(normalized)) return null;
  return normalized;
}

function parseRun(body: Record<string, unknown>) {
  for (const key of forbiddenPayloadKeys) {
    if (key in body) return null;
  }

  const id = token(body.id);
  const automationId = token(body.automationId);
  const automationName = text(body.automationName);
  const skillId = token(body.skillId);
  const triggerType = typeof body.triggerType === "string" && triggerTypes.has(body.triggerType) ? body.triggerType : null;
  const status = typeof body.status === "string" && statuses.has(body.status) ? body.status : null;
  const startedAt = isoDate(body.startedAt);
  const completedAt = isoDate(body.completedAt, true);
  const sessionRef = optionalToken(body.sessionRef);
  const partRef = optionalToken(body.partRef);
  const source = typeof body.source === "string" && sources.has(body.source) ? body.source : null;
  if (!id || !automationId || !automationName || !skillId || !triggerType || !status || !startedAt || completedAt == null || sessionRef == null || partRef == null || source == null) return null;

  const value = triggerValue(triggerType, body.triggerValue);
  if (value == null) return null;

  return {
    id,
    automationId,
    automationName,
    skillId,
    triggerType,
    triggerValue: value,
    status,
    startedAt,
    completedAt,
    sessionRef,
    partRef,
    source,
  };
}

async function authenticated(request: Request, db: D1Database) {
  if (!readUserSessionToken(request)) return null;
  return resolveUserSession(request, db);
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return privateNoStore({ error: "مصدر الطلب غير موثوق" }, 403);
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const db = await getDb();
    if (!db) return privateNoStore({ ok: false, configured: false }, 503);
    const session = await authenticated(request, db);
    if (!session) return privateNoStore({ error: "يلزم تسجيل الدخول لحفظ سجل التشغيل" }, 401);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const run = body && parseRun(body);
    if (!run) return privateNoStore({ error: "سجل التشغيل غير صالح" }, 400);

    const persistedAt = new Date().toISOString();
    await db.prepare(
      "INSERT INTO navixa_automation_runs(user_id,id,automation_id,automation_name,skill_id,trigger_type,trigger_value,status,started_at,completed_at,session_ref,part_ref,source,persisted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET automation_id=excluded.automation_id,automation_name=excluded.automation_name,skill_id=excluded.skill_id,trigger_type=excluded.trigger_type,trigger_value=excluded.trigger_value,status=excluded.status,started_at=excluded.started_at,completed_at=excluded.completed_at,session_ref=excluded.session_ref,part_ref=excluded.part_ref,source=excluded.source,persisted_at=excluded.persisted_at",
    ).bind(
      session.userId,
      run.id,
      run.automationId,
      run.automationName,
      run.skillId,
      run.triggerType,
      run.triggerValue,
      run.status,
      run.startedAt,
      run.completedAt,
      run.sessionRef,
      run.partRef,
      run.source,
      persistedAt,
    ).run();

    return privateNoStore({ ok: true, persistedAt });
  } catch {
    return privateNoStore({ error: "تعذر حفظ سجل التشغيل" }, 500);
  }
}

export async function GET(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const db = await getDb();
    if (!db) return privateNoStore({ ok: false, configured: false }, 503);
    const session = await authenticated(request, db);
    if (!session) return privateNoStore({ error: "يلزم تسجيل الدخول لقراءة سجل التشغيل" }, 401);

    const url = new URL(request.url);
    const automationIdRaw = url.searchParams.get("automationId") || "";
    const skillIdRaw = url.searchParams.get("skillId") || "";
    const statusRaw = url.searchParams.get("status") || "";
    const automationId = automationIdRaw ? token(automationIdRaw) : "";
    const skillId = skillIdRaw ? token(skillIdRaw) : "";
    const status = statusRaw ? (statuses.has(statusRaw) ? statusRaw : null) : "";
    const requestedLimit = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
    if (automationId == null || skillId == null || status == null) return privateNoStore({ error: "مرشح سجل التشغيل غير صالح" }, 400);

    const rows = await db.prepare(
      "SELECT id,automation_id,automation_name,skill_id,trigger_type,trigger_value,status,started_at,completed_at,session_ref,part_ref,source FROM navixa_automation_runs WHERE user_id=? AND (?='' OR automation_id=?) AND (?='' OR skill_id=?) AND (?='' OR status=?) ORDER BY started_at DESC LIMIT ?",
    ).bind(session.userId, automationId, automationId, skillId, skillId, status, status, limit).all<PersistedRunRow>();

    const runs = rows.results.map((row) => ({
      id: row.id,
      automationId: row.automation_id,
      automationName: row.automation_name,
      skillId: row.skill_id,
      trigger: row.trigger_type === "event"
        ? { type: "event", event: row.trigger_value }
        : row.trigger_type === "schedule"
          ? { type: "schedule", schedule: row.trigger_value }
          : { type: "manual" },
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      metadata: {
        ...(row.session_ref ? { sessionId: row.session_ref } : {}),
        ...(row.part_ref ? { partId: row.part_ref } : {}),
        ...(row.source ? { source: row.source } : {}),
      },
    }));

    return privateNoStore({ ok: true, runs });
  } catch {
    return privateNoStore({ error: "تعذر قراءة سجل التشغيل" }, 500);
  }
}
