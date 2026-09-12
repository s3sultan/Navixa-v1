import type { NameSenseBenchmarkTrial } from "../../app/api/admin/namesense-benchmark/schema.ts";

type RunResult = { success?: boolean; meta?: { changes?: number } };
export type NameSenseStatement = {
  bind: (...values: unknown[]) => NameSenseStatement;
  run: () => Promise<RunResult>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
};

export type NameSenseDb = { prepare: (sql: string) => NameSenseStatement };

export async function ensureNameSenseBenchmarkSchema(database: NameSenseDb) {
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS navixa_namesense_benchmark_speakers (
      speaker_id TEXT PRIMARY KEY,
      accent TEXT NOT NULL
    )
  `).run();
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
      captured_at TEXT NOT NULL,
      FOREIGN KEY (speaker_id) REFERENCES navixa_namesense_benchmark_speakers(speaker_id)
    )
  `).run();
}

export async function storeNameSenseBenchmarkTrial(database: NameSenseDb, trial: NameSenseBenchmarkTrial) {
  await ensureNameSenseBenchmarkSchema(database);

  try {
    await database.prepare(
      "INSERT OR IGNORE INTO navixa_namesense_benchmark_speakers (speaker_id, accent) VALUES (?, ?)",
    ).bind(trial.speakerId, trial.accent).run();
  } catch {
    return { ok: false as const, status: 409, error: "تعذر حجز مجموعة المتحدث" };
  }

  const prior = await database.prepare(
    "SELECT accent FROM navixa_namesense_benchmark_speakers WHERE speaker_id=? LIMIT 1",
  ).bind(trial.speakerId).all<{ accent: string }>();
  const existingAccent = prior.results[0]?.accent;
  if (!existingAccent || existingAccent !== trial.accent) {
    return { ok: false as const, status: 409, error: "معرّف المتحدث مستخدم مسبقًا في مجموعة لهجة أخرى" };
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
    return { ok: false as const, status: 409, error: "تعذر حفظ التجربة أو أن المعرّف مكرر" };
  }

  return { ok: true as const, trialId: trial.id };
}
