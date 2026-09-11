import assert from "node:assert/strict";
import test from "node:test";
import { scoreNameSenseBenchmark, percentile } from "../scripts/namesense-benchmark-score.mjs";

const protocol = {
  version: 2,
  evidenceMode: "human",
  releaseSplit: "holdout",
  requiredProvenance: "controlled-live",
  requiredCaptureMethod: "live-microphone",
  requiredAccents: [{ id: "en-IN", label: "Indian English" }],
  minimums: {
    speakersPerAccent: 2,
    positiveTrialsPerAccent: 2,
    negativeTrialsPerAccent: 2,
    minTrialsPerSpeakerPerAccent: 2,
    minPositiveTrialsPerSpeakerPerAccent: 1,
    minNegativeTrialsPerSpeakerPerAccent: 1,
    latencyEligiblePositiveShare: 0.5,
    latencyCoverage: 1,
    maxSpeakerSharePerAccent: 0.5,
    requiredCategoryShares: {
      deviceClass: { laptop: 0.5, headset: 0.5 },
      browser: { chrome: 0.5, edge: 0.5 },
      noise: { clean: 0.5, office: 0.5 }
    }
  },
  thresholds: {
    overallRecall: 1,
    overallRecallLower95: 0.30,
    perAccentRecall: 1,
    perAccentRecallLower95: 0.30,
    overallFalsePositiveRate: 0,
    overallFalsePositiveUpper95: 0.70,
    perAccentFalsePositiveRate: 0,
    perAccentFalsePositiveUpper95: 0.70,
    p95LatencyMs: 1500
  },
  latency: { boundary: "client-vad-name-end-to-alert" },
  signalQuality: { minRms: 0.0035, minVariance: 1e-6, minActiveSpeechMs: 80, frameMs: 20 }
};

const base = {
  mode: "human", split: "holdout", provenance: "controlled-live", captureMethod: "live-microphone",
  consent: true, rawAudioRetained: false, accent: "en-IN", latencyEligible: true,
  latencyBoundary: "client-vad-name-end-to-alert", signalQualityPassed: true, vadSpeechConfirmed: true,
  signalRms: 0.025, signalVariance: 0.0006
};
const humanTrials = [
  { ...base, id: "p1", speakerId: "s1", deviceClass: "laptop", browser: "chrome", noise: "clean", expected: "hit", detected: true, latencyMs: 800 },
  { ...base, id: "n1", speakerId: "s1", deviceClass: "laptop", browser: "chrome", noise: "clean", expected: "miss", detected: false, latencyEligible: false, latencyMs: null },
  { ...base, id: "p2", speakerId: "s2", deviceClass: "headset", browser: "edge", noise: "office", expected: "hit", detected: true, latencyMs: 1200 },
  { ...base, id: "n2", speakerId: "s2", deviceClass: "headset", browser: "edge", noise: "office", expected: "miss", detected: false, latencyEligible: false, latencyMs: null }
];

test("passes only when controlled human holdout evidence meets every gate", () => {
  const report = scoreNameSenseBenchmark(protocol, humanTrials);
  assert.equal(report.releaseReady, true);
  assert.equal(report.byAccent["en-IN"].gate.pass, true);
  assert.equal(report.overall.p95LatencyMs, 1200);
});

test("synthetic trials are never counted as release evidence", () => {
  const synthetic = humanTrials.map((trial) => ({ ...trial, id: `syn-${trial.id}`, mode: "synthetic", provenance: "generated", captureMethod: "generated" }));
  const report = scoreNameSenseBenchmark(protocol, synthetic);
  assert.equal(report.releaseReady, false);
  assert.equal(report.humanTrials, 0);
  assert.equal(report.syntheticTrialsExcludedFromReleaseEvidence, 4);
});

test("human-labelled trials are rejected without controlled live-mic provenance, consent, ephemeral raw audio, and holdout split", () => {
  const bad = humanTrials.map((trial, index) => ({ ...trial, id: `bad-${index}`, rawAudioRetained: true }));
  const report = scoreNameSenseBenchmark(protocol, bad);
  assert.equal(report.releaseReady, false);
  assert.equal(report.humanTrials, 0);
  assert.equal(report.rejectedHumanTrials, 4);
});

test("fails the release gate on a false positive even when recall is perfect", () => {
  const trials = humanTrials.map((trial) => trial.id === "n2" ? { ...trial, detected: true } : trial);
  const report = scoreNameSenseBenchmark(protocol, trials);
  assert.equal(report.releaseReady, false);
  assert.equal(report.overall.recall, 1);
  assert.equal(report.overall.falsePositiveRate, 0.5);
});

test("fails when one speaker dominates or positive/negative diversity is token-only", () => {
  const dominant = humanTrials.map((trial) => ({ ...trial, speakerId: "s1" }));
  assert.equal(scoreNameSenseBenchmark(protocol, dominant).releaseReady, false);

  const biasedPositive = humanTrials.map((trial) => trial.expected === "hit" ? { ...trial, deviceClass: "laptop" } : trial);
  const report = scoreNameSenseBenchmark(protocol, biasedPositive);
  assert.equal(report.releaseReady, false);
  assert.match(report.byAccent["en-IN"].gate.reasons.join(" "), /positive deviceClass headset share/);
});

test("fails when a holdout speaker also appears in development evidence", () => {
  const developmentLeak = { ...humanTrials[0], id: "dev-leak", split: "development", expected: "miss", detected: false, latencyEligible: false, latencyMs: null };
  const report = scoreNameSenseBenchmark(protocol, [...humanTrials, developmentLeak]);
  assert.equal(report.releaseReady, false);
  assert.equal(report.holdoutSpeakerLeakageCount, 1);
});

test("rejects latency values measured with a different boundary", () => {
  assert.throws(() => scoreNameSenseBenchmark(protocol, humanTrials.map((trial) => trial.id === "p1" ? { ...trial, latencyBoundary: "audio-start-to-alert" } : trial)), /latencyBoundary mismatch/);
});

test("rejects silent or invalid human trials from release evidence", () => {
  const invalid = humanTrials.map((trial, index) => ({ ...trial, id: `silent-${index}`, signalQualityPassed: false, vadSpeechConfirmed: false, signalRms: 0, signalVariance: 0 }));
  const report = scoreNameSenseBenchmark(protocol, invalid);
  assert.equal(report.humanTrials, 0);
  assert.equal(report.rejectedHumanTrials, 4);
  assert.equal(report.releaseReady, false);
});

test("blocks the same holdout speaker from appearing in two accent cohorts", () => {
  const twoAccentProtocol = { ...protocol, requiredAccents: [{ id: "en-IN", label: "Indian English" }, { id: "en-US", label: "American English" }] };
  const duplicated = humanTrials.map((trial, index) => ({ ...trial, id: `us-${index}`, accent: "en-US" }));
  const report = scoreNameSenseBenchmark(twoAccentProtocol, [...humanTrials, ...duplicated]);
  assert.equal(report.crossAccentSpeakerLeakageCount, 2);
  assert.equal(report.releaseReady, false);
});

test("uses nearest-rank p95 latency", () => {
  assert.equal(percentile([100, 200, 300, 400, 500], 0.95), 500);
});
