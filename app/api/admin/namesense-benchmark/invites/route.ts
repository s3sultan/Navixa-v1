import { NextResponse } from "next/server.js";
import {
  ADMIN_SESSION_COOKIE,
  isTrustedSameOriginRequest,
  readCookie,
  resolveAdminJwtSecret,
  verifyAdminSessionToken,
} from "../../../../../worker/adminAuth.ts";
import type { NameSenseDb } from "../../../../../benchmarks/namesense/storage.ts";
import { NAMESENSE_BENCHMARK_ACCENTS } from "../schema.ts";

type Accent = typeof NAMESENSE_BENCHMARK_ACCENTS[number];
type InviteRow = {
  invite_id: string;
  speaker_id: string;
  accent: Accent;
  max_trials: number;
  used_trials: number;
  expires_at: string;
  revoked: number;
  created_at: string;
};

async function db(): Promise<NameSenseDb | null> {
  try {
    return (await import("cloudflare:workers") as { env?: { DB?: NameSenseDb } }).env?.DB || null;
  } catch {
    return (globalThis as { DB?: NameSenseDb }).DB || null;
  }
}

async function allowed(request: Request, mutation = false) {
  if (mutation && !isTrustedSameOriginRequest(request)) return false;
  const secret = await resolveAdminJwtSecret();
  return Boolean(secret && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret));
}

async function ensureInviteSchema(database: NameSenseDb) {
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS navixa_namesense_study_invites (
      invite_id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      speaker_id TEXT NOT NULL UNIQUE,
      accent TEXT NOT NULL,
      max_trials INTEGER NOT NULL,
      used_trials INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `).run();
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
const randomToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return hex(bytes);
};
const hashToken = async (token: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
const isAccent = (value: unknown): value is Accent => typeof value === "string" && NAMESENSE_BENCHMARK_ACCENTS.includes(value as Accent);

export async function GET(request: Request) {
  if (!await allowed(request)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const database = await db();
  if (!database) return NextResponse.json({ configured: false, invites: [] }, { headers: { "Cache-Control": "no-store" } });
  await ensureInviteSchema(database);
  const rows = await database.prepare(`
    SELECT invite_id,speaker_id,accent,max_trials,used_trials,expires_at,revoked,created_at
    FROM navixa_namesense_study_invites
    ORDER BY created_at DESC
    LIMIT 100
  `).all<InviteRow>();
  return NextResponse.json({ configured: true, invites: rows.results }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!await allowed(request, true)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const body = await request.json().catch(() => null) as { accent?: unknown; maxTrials?: unknown; expiresHours?: unknown } | null;
  if (!body || !isAccent(body.accent)) {
    return NextResponse.json({ error: "اللهجة غير صالحة" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const maxTrials = Number(body.maxTrials ?? 40);
  const expiresHours = Number(body.expiresHours ?? 72);
  if (!Number.isInteger(maxTrials) || maxTrials < 10 || maxTrials > 60) {
    return NextResponse.json({ error: "عدد التجارب يجب أن يكون بين 10 و60" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (!Number.isFinite(expiresHours) || expiresHours < 1 || expiresHours > 168) {
    return NextResponse.json({ error: "مدة الدعوة يجب أن تكون بين ساعة و7 أيام" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const database = await db();
  if (!database) return NextResponse.json({ error: "قاعدة البيانات غير مهيأة" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  await ensureInviteSchema(database);

  const token = randomToken();
  const tokenHash = await hashToken(token);
  const inviteId = `study-${crypto.randomUUID()}`;
  const speakerId = `anon-study-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();

  try {
    await database.prepare(`
      INSERT INTO navixa_namesense_study_invites (
        invite_id,token_hash,speaker_id,accent,max_trials,used_trials,expires_at,revoked,created_at
      ) VALUES (?,?,?,?,?,0,?,0,?)
    `).bind(inviteId, tokenHash, speakerId, body.accent, maxTrials, expiresAt, createdAt).run();
  } catch {
    return NextResponse.json({ error: "تعذر إنشاء الدعوة" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    ok: true,
    inviteId,
    accent: body.accent,
    maxTrials,
    expiresAt,
    invitePath: `/namesense-study?invite=${token}`,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  if (!await allowed(request, true)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const body = await request.json().catch(() => null) as { inviteId?: unknown } | null;
  const inviteId = typeof body?.inviteId === "string" ? body.inviteId.trim() : "";
  if (!/^study-[a-f0-9-]{20,80}$/i.test(inviteId)) {
    return NextResponse.json({ error: "معرّف الدعوة غير صالح" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const database = await db();
  if (!database) return NextResponse.json({ error: "قاعدة البيانات غير مهيأة" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  await ensureInviteSchema(database);
  await database.prepare("UPDATE navixa_namesense_study_invites SET revoked=1 WHERE invite_id=?").bind(inviteId).run();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
