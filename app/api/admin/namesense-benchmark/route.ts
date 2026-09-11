import { NextResponse } from "next/server.js";
import {
  ADMIN_SESSION_COOKIE,
  isTrustedSameOriginRequest,
  readCookie,
  resolveAdminJwtSecret,
  verifyAdminSessionToken,
} from "../../../../worker/adminAuth.ts";
import { validateNameSenseBenchmarkTrial } from "./schema.ts";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  run: () => Promise<{ success?: boolean }>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
};
type Db = { prepare: (sql: string) => Statement };

async function db(): Promise<Db | null> {
  try {
    return (await import("cloudflare:workers") as { env?: { DB?: Db } }).env?.DB || null;
  } catch {
    return (globalThis as { DB?: Db }).DB || null;
  }
}

async function allowed(request: Request, mutation = false) {
  if (mutation && !isTrustedSameOriginRequest(request)) return false;
  const secret = await resolveAdminJwtSecret();
  return Boolean(secret && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret));
}

async function ensureSchema(database: Db) {
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS navixa_namesense_benchmark_trials (
      trial_id TEXT PRIMARY KEY,
      speaker_id TEXT NOT NULL,
      accent TEXT NOT NULL,
      watched_name_id TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      device_class TEXT NOT NULL,
      browser TEXT NOT NULL,
      noise TEXT NOT NULL,
      expected TEXT NOT NULL,
      detected INTEGER NOT NULL,
      latency_eligible INTEGER NOT NULL,
      latency_ms INTEGER,
      latency_boundary TEXT NOT NULL,
      signal_quality_passed INTEGER NOT NULL,
      vad_speech_confirmed INTEGER NOT NULL,
      signal_rms REAL NOT NULL,
      signal_variance REAL NOT NULL,
      split TEXT NOT NULL,
      provenance TEXT NOT NULL,
      capture_method TEXT NOT NULL,
      consent INTEGER NOT NULL,
      raw_audio_retained INTEGER NOT NULL,
      match_method TEXT,
      match_score REAL,
      captured_at TEXT NOT NULL
    )
  `).run();
}

type AccentRow = {
  accent: string;
  trials: number;
  speakers: number;
  positives: number;
  negatives: number;
  tp: number;
  fn: number;
  fp: number;
  tn: number;
};

export async function GET(request: Request) {
  if (!await allowed(request)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const database = await db();
  if (!database) return NextResponse.json({ configured: false, accents: [] }, { headers: { "Cache-Control": "no-store" } });
  await ensureSchema(database);
  const rows = await database.prepare(`
    SELECT
      accent,
      COUNT(*) AS trials,
      COUNT(DISTINCT speaker_id) AS speakers,
      SUM(CASE WHEN expected='hit' THEN 1 ELSE 0 END) AS positives,
      SUM(CASE WHEN expected='miss' THEN 1 ELSE 0 END) AS negatives,
      SUM(CASE WHEN expected='hit' AND detected=1 THEN 1 ELSE 0 END) AS tp,
      SUM(CASE WHEN expected='hit' AND detected=0 THEN 1 ELSE 0 END) AS fn,
      SUM(CASE WHEN expected='miss' AND detected=1 THEN 1 ELSE 0 END) AS fp,
      SUM(CASE WHEN expected='miss' AND detected=0 THEN 1 ELSE 0 END) AS tn
    FROM navixa_namesense_benchmark_trials
    GROUP BY accent
    ORDER BY accent
  `).all<AccentRow>();
  return NextResponse.json(
    { configured: true, accents: rows.results },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  if (!await allowed(request, true)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = validateNameSenseBenchmarkTrial(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const database = await db();
  if (!database) return NextResponse.json({ error: "قاعدة البيانات غير مهيأة" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  await ensureSchema(database);

  const trial = parsed.trial;
  const prior = await database.prepare(
    "SELECT accent FROM navixa_namesense_benchmark_trials WHERE speaker_id=? LIMIT 1",
  ).bind(trial.speakerId).all<{ accent: string }>();
  const existingAccent = prior.results[0]?.accent;
  if (existingAccent && existingAccent !== trial.accent) {
    return NextResponse.json(
      { error: "معرّف المتحدث مستخدم مسبقًا في مجموعة لهجة أخرى" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const now = new Date().toISOString();
  try {
    await database.prepare(`
      INSERT INTO navixa_namesense_benchmark_trials (
        trial_id,speaker_id,accent,watched_name_id,prompt_id,device_class,browser,noise,
        expected,detected,latency_eligible,latency_ms,latency_boundary,
        signal_quality_passed,vad_speech_confirmed,signal_rms,signal_variance,
        split,provenance,capture_method,consent,raw_audio_retained,match_method,match_score,captured_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      trial.id,
      trial.speakerId,
      trial.accent,
      trial.watchedNameId,
      trial.promptId,
      trial.deviceClass,
      trial.browser,
      trial.noise,
      trial.expected,
      trial.detected ? 1 : 0,
      trial.latencyEligible ? 1 : 0,
      trial.latencyMs,
      trial.latencyBoundary,
      1,
      1,
      trial.signalRms,
      trial.signalVariance,
      trial.split,
      trial.provenance,
      trial.captureMethod,
      1,
      0,
      trial.matchMethod,
      trial.matchScore,
      now,
    ).run();
  } catch {
    return NextResponse.json(
      { error: "تعذر حفظ التجربة أو أن المعرّف مكرر" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({ ok: true, trialId: trial.id }, { headers: { "Cache-Control": "private, no-store" } });
}
