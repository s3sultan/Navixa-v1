import assert from "node:assert/strict";
import test from "node:test";
import { scoreNameSenseBenchmark, percentile } from "../scripts/namesense-benchmark-score.mjs";

const protocol = {
  version: 1,
  evidenceMode: "human",
  requiredAccents: [{ id: "en-IN", label: "Indian English" }],
  minimums: {
    speakersPerAccent: 2,
    positiveTrialsPerAccent: 2,
    negativeTrialsPerAccent: 2,
    deviceClassesPerAccent: 2,
    browsersPerAccent: 2,
    noiseConditionsPerAccent: 2,
    latencyCoverage: 1,
    maxSpeakerShare: 0.5
  },
  thresholds: {
    overallRecall: 1,
    perAccentRecall: 1,
    overallFalsePositiveRate: 0,
    perAccentFalsePositiveRate: 0,
    p95LatencyMs: 1500
  }
};

const humanTrials = [
  { id: "p1", mode: "human", accent: "en-IN", speakerId: "s1", deviceClass: "laptop", browser: "chrome", noise: "clean", expected: "hit", detected: true, latencyMs: 800 },
  { id: "n1", mode: "human", accent: "en-IN", speakerId: "s1", deviceClass: "laptop", browser: "chrome", noise: "clean", expected: "miss", detected: false },
  { id: "p2", mode: "human", accent: "en-IN", speakerId: "s2", deviceClass: "headset", browser: "edge", noise: "office", expected: "hit", detected: true, latencyMs: 1200 },
  { id: "n2", mode: "human", accent: "en-IN", speakerId: "s2", deviceClass: "headset", browser: "edge", noise: "office", expected: "miss", detected: false }
];

test("passes only when human evidence meets every quality and metric gate", () => {
  const report = scoreNameSenseBenchmark(protocol, humanTrials);
  assert.equal(report.releaseReady, true);
  assert.equal(report.byAccent["en-IN"].gate.pass, true);
  assert.equal(report.overall.recall, 1);
  assert.equal(report.overall.falsePositiveRate, 0);
  assert.equal(report.overall.p95LatencyMs, 1200);
});

test("synthetic trials are never counted as release evidence", () => {
  const synthetic = humanTrials.map((trial) => ({ ...trial, id: `syn-${trial.id}`, mode: "synthetic" }));
  const report = scoreNameSenseBenchmark(protocol, synthetic);
  assert.equal(report.releaseReady, false);
  assert.equal(report.humanTrials, 0);
  assert.equal(report.syntheticTrialsExcludedFromReleaseEvidence, 4);
});

test("fails the release gate on a false positive even when recall is perfect", () => {
  const trials = humanTrials.map((trial) => trial.id === "n2" ? { ...trial, detected: true } : trial);
  const report = scoreNameSenseBenchmark(protocol, trials);
  assert.equal(report.releaseReady, false);
  assert.equal(report.overall.recall, 1);
  assert.equal(report.overall.falsePositiveRate, 0.5);
});

test("fails when one speaker dominates the sample", () => {
  const trials = humanTrials.map((trial) => ({ ...trial, speakerId: "s1" }));
  const report = scoreNameSenseBenchmark(protocol, trials);
  assert.equal(report.releaseReady, false);
  assert.match(report.byAccent["en-IN"].gate.reasons.join(" "), /speaker/);
});

test("uses nearest-rank p95 latency", () => {
  assert.equal(percentile([100, 200, 300, 400, 500], 0.95), 500);
});
