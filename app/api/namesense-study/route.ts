import { NextResponse } from "next/server.js";
import { isTrustedSameOriginRequest } from "../../../worker/adminAuth.ts";
import {
  ensureNameSenseBenchmarkSchema,
  storeNameSenseBenchmarkTrial,
  type NameSenseDb,
} from "../../../benchmarks/namesense/storage.ts";
import {
  getNameSenseStudyPrompt,
  nextNameSenseStudyAssignment,
  type NameSenseStudyAccent,
} from "../../../benchmarks/namesense/study.ts";
import { validateNameSenseBenchmarkTrial } from "../admin/namesense-benchmark/schema.ts";

type InviteRow = {
  invite_id: string;
  token_hash: string;
  client_hash: string | null;
  speaker_id: string;
  accent: NameSenseStudyAccent;
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
      client_hash TEXT,
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
const hashValue = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
const tokenPattern = /^[a-f0-9]{64}$/i;
const clientNoncePattern = /^[a-f0-9]{64}$/i;

async function findInviteByHash(database: NameSenseDb, tokenHash: string) {
  await ensureInviteSchema(database);
  const rows = await database.prepare(`
    SELECT invite_id,token_hash,client_hash,speaker_id,accent,max_trials,used_trials,expires_at,revoked
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

async function resolveBoundInvite(database: NameSenseDb, token: string, clientNonce: string) {
  if (!tokenPattern.test(token) || !clientNoncePattern.test(clientNonce)) return { ok: false as const, status: 400, error: "بيانات المشاركة غير صالحة" };
  const tokenHash = await hashValue(token.toLowerCase());
  const clientHash = await hashValue(clientNonce.toLowerCase());
  let invite = await findInviteByHash(database, tokenHash);
  if (!active(invite)) return { ok: false as const, status: 410, error: "رابط المشاركة غير صالح أو انتهت صلاحيته" };

  if (!invite!.client_hash) {
    await database.prepare(`
      UPDATE navixa_namesense_study_invites
      SET client_hash=?
      WHERE token_hash=? AND client_hash IS NULL AND revoked=0 AND expires_at>?
    `).bind(clientHash, tokenHash, new Date().toISOString()).run();
    invite = await findInviteByHash(database, tokenHash);
  }

  if (!invite || invite.client_hash !== clientHash) {
    return { ok: false as const, status: 409, error: "هذه الدعوة مرتبطة بجلسة مشارك أخرى" };
  }
  if (!active(invite)) return { ok: false as const, status: 410, error: "رابط المشاركة غير صالح أو اكتملت محاولاته" };
  return { ok: true as const, invite, tokenHash, clientHash };
}

function readCredentials(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = body as { invite?: unknown; clientNonce?: unknown; trial?: unknown };
  const invite = typeof value.invite === "string" ? value.invite.trim().toLowerCase() : "";
  const clientNonce = typeof value.clientNonce === "string" ? value.clientNonce.trim().toLowerCase() : "";
  return { invite, clientNonce, trial: value.trial };
}

export async function PUT(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const credentials = readCredentials(await request.json().catch(() => null));
  if (!credentials) return NextResponse.json({ error: "بيانات المشاركة غير صالحة" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const database = await db();
  if (!database) return NextResponse.json({ error: "الدراسة غير متاحة الآن" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const resolved = await resolveBoundInvite(database, credentials.invite, credentials.clientNonce);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status, headers: { "Cache-Control": "no-store" } });

  const assignment = nextNameSenseStudyAssignment(resolved.invite.used_trials);
  const prompt = getNameSenseStudyPrompt(resolved.invite.used_trials, resolved.invite.accent, assignment);
  return NextResponse.json({
    ok: true,
    accent: resolved.invite.accent,
    speakerId: resolved.invite.speaker_id,
    remainingTrials: Math.max(0, resolved.invite.max_trials - resolved.invite.used_trials),
    maxTrials: resolved.invite.max_trials,
    expiresAt: resolved.invite.expires_at,
    nextExpected: assignment.expected,
    nextNameId: assignment.nameId,
    prompt,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const credentials = readCredentials(await request.json().catch(() => null));
  if (!credentials) return NextResponse.json({ error: "بيانات المشاركة غير صالحة" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const database = await db();
  if (!database) return NextResponse.json({ error: "الدراسة غير متاحة الآن" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  await ensureNameSenseBenchmarkSchema(database);
  const resolved = await resolveBoundInvite(database, credentials.invite, credentials.clientNonce);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status, headers: { "Cache-Control": "no-store" } });

  const assignment = nextNameSenseStudyAssignment(resolved.invite.used_trials);
  const prompt = getNameSenseStudyPrompt(resolved.invite.used_trials, resolved.invite.accent, assignment);
  const rawTrial = credentials.trial && typeof credentials.trial === "object" && !Array.isArray(credentials.trial)
    ? credentials.trial as Record<string, unknown>
    : null;
  if (!rawTrial || rawTrial.promptId !== prompt.id) {
    return NextResponse.json({ error: "الجملة لا تطابق الجولة الحالية؛ أعد تحميل الصفحة" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  const trialInput = {
    ...rawTrial,
    accent: resolved.invite.accent,
    speakerId: resolved.invite.speaker_id,
    expected: assignment.expected,
    watchedNameId: assignment.nameId,
    promptId: prompt.id,
    latencyEligible: prompt.latencyEligible,
  };
  const parsed = validateNameSenseBenchmarkTrial(trialInput);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const claimed = await database.prepare(`
    UPDATE navixa_namesense_study_invites
    SET used_trials=used_trials+1
    WHERE token_hash=? AND client_hash=? AND revoked=0 AND expires_at>? AND used_trials<max_trials AND used_trials=?
  `).bind(resolved.tokenHash, resolved.clientHash, new Date().toISOString(), resolved.invite.used_trials).run();
  if ((claimed.meta?.changes ?? 0) !== 1) {
    return NextResponse.json({ error: "تغيرت حالة الدعوة؛ أعد تحميل الصفحة" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  const stored = await storeNameSenseBenchmarkTrial(database, parsed.trial);
  const usedTrials = resolved.invite.used_trials + 1;
  const next = nextNameSenseStudyAssignment(usedTrials);
  const nextPrompt = getNameSenseStudyPrompt(usedTrials, resolved.invite.accent, next);
  if (!stored.ok) {
    return NextResponse.json({
      error: "تعذر حفظ هذه الجولة؛ تم تجاوزها حفاظًا على نزاهة عداد الدراسة",
      remainingTrials: Math.max(0, resolved.invite.max_trials - usedTrials),
      nextExpected: next.expected,
      nextNameId: next.nameId,
      prompt: nextPrompt,
      refreshRequired: true,
    }, { status: stored.status, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    ok: true,
    trialId: stored.trialId,
    remainingTrials: Math.max(0, resolved.invite.max_trials - usedTrials),
    nextExpected: next.expected,
    nextNameId: next.nameId,
    prompt: nextPrompt,
    completed: usedTrials >= resolved.invite.max_trials,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
