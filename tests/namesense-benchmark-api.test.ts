import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateNameSenseBenchmarkTrial } from "../app/api/admin/namesense-benchmark/schema.ts";
import {
  nameSenseStudyPromptMatchesAssignment,
  nextNameSenseStudyAssignment,
} from "../benchmarks/namesense/study.ts";

const base = {
  id: "trial-12345678-abcd",
  mode: "human",
  split: "holdout",
  provenance: "controlled-live",
  captureMethod: "live-microphone",
  consent: true,
  rawAudioRetained: false,
  signalQualityPassed: true,
  vadSpeechConfirmed: true,
  signalRms: 0.02,
  signalVariance: 0.0002,
  accent: "en-IN",
  speakerId: "anon-12345678-abcd",
  watchedNameId: "sultan",
  promptId: "name-only",
  deviceClass: "laptop-built-in",
  browser: "desktop-chromium",
  noise: "clean",
  expected: "hit",
  detected: true,
  latencyEligible: true,
  latencyMs: 640,
  latencyBoundary: "client-vad-name-end-to-alert",
  matchMethod: "phonetic",
  matchScore: 0.9,
};

test("accepts a qualifying privacy-safe human benchmark record", () => {
  const result = validateNameSenseBenchmarkTrial(base);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.trial.rawAudioRetained, false);
    assert.equal(result.trial.speakerId, base.speakerId);
  }
});

test("rejects raw audio, transcripts and direct identity fields", () => {
  for (const extra of [
    { audio: [0.1] },
    { transcript: "Sultan" },
    { email: "person@example.com" },
    { userId: "123" },
    { ipAddress: "203.0.113.5" },
    { location: "somewhere" },
  ]) {
    const result = validateNameSenseBenchmarkTrial({ ...base, ...extra });
    assert.equal(result.ok, false);
  }
});

test("rejects synthetic, non-holdout, retained-audio and weak-signal trials", () => {
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, mode: "synthetic" }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, split: "development" }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, rawAudioRetained: true }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, signalRms: 0.0001 }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, signalVariance: 1e-8 }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, vadSpeechConfirmed: false }).ok, false);
});

test("requires latency for detected latency-eligible trials and the exact boundary", () => {
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, latencyMs: null }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, latencyBoundary: "button-to-alert" }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, latencyMs: 16_000 }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, detected: false, latencyMs: null }).ok, true);
});

test("rejects unsupported cohort labels and non-pseudonymous speaker ids", () => {
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, accent: "en-AU" }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, deviceClass: "mystery-device" }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, browser: "unknown" }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, noise: "party" }).ok, false);
  assert.equal(validateNameSenseBenchmarkTrial({ ...base, speakerId: "Sultan Alharbi" }).ok, false);
});

test("study assignment alternates hit and miss while rotating names", () => {
  assert.deepEqual(nextNameSenseStudyAssignment(0), { expected: "hit", nameId: "sultan" });
  assert.deepEqual(nextNameSenseStudyAssignment(1), { expected: "miss", nameId: "mohammed" });
  assert.deepEqual(nextNameSenseStudyAssignment(2), { expected: "hit", nameId: "alharbi" });
  assert.deepEqual(nextNameSenseStudyAssignment(3), { expected: "miss", nameId: "sultan" });
  assert.deepEqual(nextNameSenseStudyAssignment(-1), { expected: "hit", nameId: "sultan" });
});

test("study prompt must match the server-owned name and expected class", () => {
  const positive = { expected: "hit" as const, nameId: "sultan" as const };
  const negative = { expected: "miss" as const, nameId: "mohammed" as const };
  assert.equal(nameSenseStudyPromptMatchesAssignment("name-only-sultan", positive), true);
  assert.equal(nameSenseStudyPromptMatchesAssignment("negative-sultan-1", positive), false);
  assert.equal(nameSenseStudyPromptMatchesAssignment("negative-mohammed-2", negative), true);
  assert.equal(nameSenseStudyPromptMatchesAssignment("direct-question-mohammed", negative), false);
  assert.equal(nameSenseStudyPromptMatchesAssignment("negative-sultan-2", negative), false);
});

test("study invite token stays out of request URLs and browser address after activation", () => {
  const adminInviteRoute = readFileSync(new URL("../app/api/admin/namesense-benchmark/invites/route.ts", import.meta.url), "utf8");
  const publicRoute = readFileSync(new URL("../app/api/namesense-study/route.ts", import.meta.url), "utf8");
  const participantPage = readFileSync(new URL("../app/namesense-study/page.tsx", import.meta.url), "utf8");

  assert.match(adminInviteRoute, /invitePath:\s*`\/namesense-study#invite=\$\{token\}`/);
  assert.doesNotMatch(adminInviteRoute, /namesense-study\?invite=/);
  assert.match(publicRoute, /export async function PUT\(/);
  assert.doesNotMatch(publicRoute, /searchParams\.get\(["']invite["']\)/);
  assert.match(participantPage, /window\.location\.hash/);
  assert.match(participantPage, /history\.replaceState/);
  assert.doesNotMatch(participantPage, /\/api\/namesense-study\?invite=/);
});

test("study invite is browser-bound and failed storage never rolls the usage counter backward", () => {
  const publicRoute = readFileSync(new URL("../app/api/namesense-study/route.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../migrations/0053_namesense_study_invites.sql", import.meta.url), "utf8");

  assert.match(migration, /client_hash TEXT/);
  assert.match(publicRoute, /client_hash=\?/);
  assert.match(publicRoute, /client_hash IS NULL/);
  assert.match(publicRoute, /client_hash=\? AND revoked=0/);
  assert.doesNotMatch(publicRoute, /used_trials=CASE WHEN used_trials>0 THEN used_trials-1/);
});
