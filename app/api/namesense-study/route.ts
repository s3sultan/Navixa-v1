import { NextResponse } from "next/server.js";
import { isTrustedSameOriginRequest } from "../../../worker/adminAuth.ts";
import {
  ensureNameSenseBenchmarkSchema,
  storeNameSenseBenchmarkTrial,
  type NameSenseDb,
} from "../../../benchmarks/namesense/storage.ts";
import {
  nameSenseStudyPromptMatchesAssignment,
  nextNameSenseStudyAssignment,
} from "../../../benchmarks/namesense/study.ts";
import { validateNameSenseBenchmarkTrial } from "../admin/namesense-benchmark/schema.ts";

type InviteRow = {
  invite_id: string;
  speaker_id: string;
  accent: string;
  max_trials: number;
  used_trials: number;
  expires_at: string;
  revoked: number;
};

async function db(): Promise<NameSenseDb | null> {
  try {
    return (await import("cloudflare:workers") as { env?: { DB?: NameSenseDb } }).env?.DB || null;
  } catch {
    return (globalThis as { DB?: NameSenseDb }).DB || null;
  }
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
const hashToken = async (token: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
const tokenPattern = /^[a-f0-9]{64}$/i;

async function findInvite(database: NameSenseDb, token: string) {
  if (!tokenPattern.test(token)) return null;
  await ensureInviteSchema(database);
  const tokenHash = await hashToken(token.toLowerCase());
  const rows = await database.prepare(`
    SELECT invite_id,speaker_id,accent,max_trials,used_trials,expires_at,revoked
    FROM navixa_namesense_study_invites
    WHERE token_hash=?
    LIMIT 1
  `).bind(tokenHash).all<InviteRow>();
  return rows.results[0] || null;
}

function active(invite: InviteRow | null) {
  return Boolean(
    invite &&
    invite.revoked === 0 &&
    invite.used_trials < invite.max_trials &&
    Date.parse(invite.expires_at) > Date.now()
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("invite")?.trim() || "";
  const database = await db();
  if (!database) return NextResponse.json({ error: "الدراسة غير متاحة الآن" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const invite = await findInvite(database, token);
  if (!active(invite)) {
    return NextResponse.json({ error: "رابط المشاركة غير صالح أو انتهت صلاحيته" }, { status: 410, headers: { "Cache-Control": "no-store" } });
  }
  const assignment = nextNameSenseStudyAssignment(invite!.used_trials);
  return NextResponse.json({
    ok: true,
    accent: invite!.accent,
    speakerId: invite!.speaker_id,
    remainingTrials: Math.max(0, invite!.max_trials - invite!.used_trials),
    maxTrials: invite!.max_trials,
    expiresAt: invite!.expires_at,
    nextExpected: assignment.expected,
    nextNameId: assignment.nameId,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const body = await request.json().catch(() => null) as { invite?: unknown; trial?: unknown } | null;
  const token = typeof body?.invite === "string" ? body.invite.trim().toLowerCase() : "";
  if (!tokenPattern.test(token)) {
    return NextResponse.json({ error: "رمز المشاركة غير صالح" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const database = await db();
  if (!database) return NextResponse.json({ error: "الدراسة غير متاحة الآن" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  await ensureNameSenseBenchmarkSchema(database);
  const invite = await findInvite(database, token);
  if (!active(invite)) {
    return NextResponse.json({ error: "رابط المشاركة غير صالح أو اكتملت محاولاته" }, { status: 410, headers: { "Cache-Control": "no-store" } });
  }

  const assignment = nextNameSenseStudyAssignment(invite!.used_trials);
  const rawTrial = body?.trial && typeof body.trial === "object" && !Array.isArray(body.trial)
    ? body.trial as Record<string, unknown>
    : null;
  if (!rawTrial || !nameSenseStudyPromptMatchesAssignment(rawTrial.promptId, assignment)) {
    return NextResponse.json({ error: "الجملة لا تطابق الجولة الحالية؛ أعد تحميل الصفحة" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  const trialInput = {
    ...rawTrial,
    accent: invite!.accent,
    speakerId: invite!.speaker_id,
    expected: assignment.expected,
    watchedNameId: assignment.nameId,
  };
  const parsed = validateNameSenseBenchmarkTrial(trialInput);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const tokenHash = await hashToken(token);
  const claimed = await database.prepare(`
    UPDATE navixa_namesense_study_invites
    SET used_trials=used_trials+1
    WHERE token_hash=? AND revoked=0 AND expires_at>? AND used_trials<max_trials AND used_trials=?
  `).bind(tokenHash, new Date().toISOString(), invite!.used_trials).run();
  if ((claimed.meta?.changes ?? 0) !== 1) {
    return NextResponse.json({ error: "تغيرت حالة الدعوة؛ أعد تحميل الصفحة" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  const stored = await storeNameSenseBenchmarkTrial(database, parsed.trial);
  if (!stored.ok) {
    await database.prepare(
      "UPDATE navixa_namesense_study_invites SET used_trials=CASE WHEN used_trials>0 THEN used_trials-1 ELSE 0 END WHERE token_hash=?",
    ).bind(tokenHash).run().catch(() => undefined);
    return NextResponse.json({ error: stored.error }, { status: stored.status, headers: { "Cache-Control": "no-store" } });
  }

  const usedTrials = invite!.used_trials + 1;
  const next = nextNameSenseStudyAssignment(usedTrials);
  return NextResponse.json({
    ok: true,
    trialId: stored.trialId,
    remainingTrials: Math.max(0, invite!.max_trials - usedTrials),
    nextExpected: next.expected,
    nextNameId: next.nameId,
    completed: usedTrials >= invite!.max_trials,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
