import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_TRIAL_FIELDS = ["id", "mode", "accent", "speakerId", "deviceClass", "browser", "noise", "expected", "detected"];

const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;

export function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1));
  return sorted[rank];
}

export function wilsonInterval(successes, total, z = 1.959963984540054) {
  if (!total) return { lower: null, upper: null };
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total) / denominator;
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

function validateProtocol(protocol) {
  if (!protocol || !Array.isArray(protocol.requiredAccents) || !protocol.requiredAccents.length) {
    throw new Error("protocol.requiredAccents must be a non-empty array");
  }
  if (!protocol.minimums || !protocol.thresholds) throw new Error("protocol minimums/thresholds are required");
}

function validateTrials(trials) {
  if (!Array.isArray(trials)) throw new Error("results must be an array of benchmark trials");
  const ids = new Set();
  for (const [index, trial] of trials.entries()) {
    for (const field of REQUIRED_TRIAL_FIELDS) {
      if (!(field in trial)) throw new Error(`trial ${index} is missing ${field}`);
    }
    if (ids.has(trial.id)) throw new Error(`duplicate trial id: ${trial.id}`);
    ids.add(trial.id);
    if (trial.mode !== "human" && trial.mode !== "synthetic") throw new Error(`invalid mode for ${trial.id}`);
    if (trial.expected !== "hit" && trial.expected !== "miss") throw new Error(`invalid expected value for ${trial.id}`);
    if (typeof trial.detected !== "boolean") throw new Error(`detected must be boolean for ${trial.id}`);
    if (trial.latencyMs != null && (!Number.isFinite(trial.latencyMs) || trial.latencyMs < 0)) {
      throw new Error(`latencyMs must be a non-negative number for ${trial.id}`);
    }
  }
}

function summarizeTrials(trials) {
  const positives = trials.filter((trial) => trial.expected === "hit");
  const negatives = trials.filter((trial) => trial.expected === "miss");
  const truePositives = positives.filter((trial) => trial.detected);
  const falseNegatives = positives.length - truePositives.length;
  const falsePositives = negatives.filter((trial) => trial.detected).length;
  const trueNegatives = negatives.length - falsePositives;
  const latencies = truePositives
    .map((trial) => trial.latencyMs)
    .filter((value) => Number.isFinite(value));
  const speakerCounts = new Map();
  for (const trial of trials) speakerCounts.set(trial.speakerId, (speakerCounts.get(trial.speakerId) || 0) + 1);
  const maxSpeakerTrials = Math.max(0, ...speakerCounts.values());

  return {
    trials: trials.length,
    positives: positives.length,
    negatives: negatives.length,
    truePositives: truePositives.length,
    falseNegatives,
    falsePositives,
    trueNegatives,
    recall: ratio(truePositives.length, positives.length),
    recall95: wilsonInterval(truePositives.length, positives.length),
    falsePositiveRate: ratio(falsePositives, negatives.length),
    falsePositiveRate95: wilsonInterval(falsePositives, negatives.length),
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    latencyCoverage: ratio(latencies.length, truePositives.length),
    speakers: speakerCounts.size,
    devices: new Set(trials.map((trial) => trial.deviceClass)).size,
    browsers: new Set(trials.map((trial) => trial.browser)).size,
    noiseConditions: new Set(trials.map((trial) => trial.noise)).size,
    maxSpeakerShare: ratio(maxSpeakerTrials, trials.length)
  };
}

function checkAccentGate(summary, protocol) {
  const { minimums, thresholds } = protocol;
  const reasons = [];
  if (summary.speakers < minimums.speakersPerAccent) reasons.push(`speakers ${summary.speakers}/${minimums.speakersPerAccent}`);
  if (summary.positives < minimums.positiveTrialsPerAccent) reasons.push(`positive trials ${summary.positives}/${minimums.positiveTrialsPerAccent}`);
  if (summary.negatives < minimums.negativeTrialsPerAccent) reasons.push(`negative trials ${summary.negatives}/${minimums.negativeTrialsPerAccent}`);
  if (summary.devices < minimums.deviceClassesPerAccent) reasons.push(`device classes ${summary.devices}/${minimums.deviceClassesPerAccent}`);
  if (summary.browsers < minimums.browsersPerAccent) reasons.push(`browsers ${summary.browsers}/${minimums.browsersPerAccent}`);
  if (summary.noiseConditions < minimums.noiseConditionsPerAccent) reasons.push(`noise conditions ${summary.noiseConditions}/${minimums.noiseConditionsPerAccent}`);
  if (summary.truePositives > 0 && (summary.latencyCoverage ?? 0) < minimums.latencyCoverage) reasons.push(`latency coverage ${(summary.latencyCoverage ?? 0).toFixed(3)} < ${minimums.latencyCoverage}`);
  if (summary.trials > 0 && (summary.maxSpeakerShare ?? 0) > minimums.maxSpeakerShare) reasons.push(`speaker dominance ${(summary.maxSpeakerShare ?? 0).toFixed(3)} > ${minimums.maxSpeakerShare}`);
  if (summary.positives > 0 && (summary.recall ?? 0) < thresholds.perAccentRecall) reasons.push(`recall ${(summary.recall ?? 0).toFixed(4)} < ${thresholds.perAccentRecall}`);
  if (summary.negatives > 0 && (summary.falsePositiveRate ?? 0) > thresholds.perAccentFalsePositiveRate) reasons.push(`FPR ${(summary.falsePositiveRate ?? 0).toFixed(4)} > ${thresholds.perAccentFalsePositiveRate}`);
  if (summary.truePositives > 0 && (summary.p95LatencyMs == null || summary.p95LatencyMs > thresholds.p95LatencyMs)) reasons.push(`p95 latency ${summary.p95LatencyMs ?? "n/a"}ms > ${thresholds.p95LatencyMs}ms`);
  return { pass: reasons.length === 0, reasons };
}

export function scoreNameSenseBenchmark(protocol, rawTrials) {
  validateProtocol(protocol);
  validateTrials(rawTrials);
  const requiredAccentIds = protocol.requiredAccents.map((item) => item.id);
  const humanTrials = rawTrials.filter((trial) => trial.mode === protocol.evidenceMode && requiredAccentIds.includes(trial.accent));
  const syntheticTrials = rawTrials.filter((trial) => trial.mode === "synthetic");
  const byAccent = {};

  for (const accent of protocol.requiredAccents) {
    const summary = summarizeTrials(humanTrials.filter((trial) => trial.accent === accent.id));
    byAccent[accent.id] = { ...summary, gate: checkAccentGate(summary, protocol) };
  }

  const overall = summarizeTrials(humanTrials);
  const overallReasons = [];
  if (overall.positives === 0) overallReasons.push("no human positive trials");
  else if ((overall.recall ?? 0) < protocol.thresholds.overallRecall) overallReasons.push(`overall recall ${(overall.recall ?? 0).toFixed(4)} < ${protocol.thresholds.overallRecall}`);
  if (overall.negatives === 0) overallReasons.push("no human negative trials");
  else if ((overall.falsePositiveRate ?? 0) > protocol.thresholds.overallFalsePositiveRate) overallReasons.push(`overall FPR ${(overall.falsePositiveRate ?? 0).toFixed(4)} > ${protocol.thresholds.overallFalsePositiveRate}`);
  if (overall.truePositives === 0) overallReasons.push("no true-positive latency evidence");
  else if (overall.p95LatencyMs == null || overall.p95LatencyMs > protocol.thresholds.p95LatencyMs) overallReasons.push(`overall p95 latency ${overall.p95LatencyMs ?? "n/a"}ms > ${protocol.thresholds.p95LatencyMs}ms`);
  const failedAccents = Object.entries(byAccent).filter(([, value]) => !value.gate.pass).map(([accent]) => accent);
  if (failedAccents.length) overallReasons.push(`accent gates not ready: ${failedAccents.join(", ")}`);

  return {
    protocolVersion: protocol.version,
    evidenceMode: protocol.evidenceMode,
    humanTrials: humanTrials.length,
    syntheticTrialsExcludedFromReleaseEvidence: syntheticTrials.length,
    overall: { ...overall, gate: { pass: overallReasons.length === 0, reasons: overallReasons } },
    byAccent,
    releaseReady: overallReasons.length === 0
  };
}

export function formatNameSenseBenchmarkReport(report) {
  const percent = (value) => value == null ? "n/a" : `${(value * 100).toFixed(2)}%`;
  const lines = [
    `NameSense benchmark: ${report.releaseReady ? "PASS" : "NOT READY"}`,
    `Human trials: ${report.humanTrials}`,
    `Synthetic trials excluded from release evidence: ${report.syntheticTrialsExcludedFromReleaseEvidence}`,
    `Overall recall: ${percent(report.overall.recall)} (95% CI ${percent(report.overall.recall95.lower)}-${percent(report.overall.recall95.upper)})`,
    `Overall false-positive rate: ${percent(report.overall.falsePositiveRate)} (95% CI ${percent(report.overall.falsePositiveRate95.lower)}-${percent(report.overall.falsePositiveRate95.upper)})`,
    `Overall p95 latency: ${report.overall.p95LatencyMs ?? "n/a"} ms`
  ];
  for (const [accent, metrics] of Object.entries(report.byAccent)) {
    lines.push(`${accent}: ${metrics.gate.pass ? "PASS" : "NOT READY"} | recall ${percent(metrics.recall)} | FPR ${percent(metrics.falsePositiveRate)} | p95 ${metrics.p95LatencyMs ?? "n/a"} ms | speakers ${metrics.speakers}`);
    if (!metrics.gate.pass) lines.push(`  - ${metrics.gate.reasons.join("; ")}`);
  }
  if (!report.releaseReady) lines.push(`Blocking reasons: ${report.overall.gate.reasons.join("; ")}`);
  return lines.join("\n");
}

async function runCli() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const protocolPath = process.argv[2] || path.resolve(here, "../benchmarks/namesense/protocol.json");
  const resultsPath = process.argv[3];
  if (!resultsPath) {
    console.error("Usage: node scripts/namesense-benchmark-score.mjs [protocol.json] results.json");
    process.exitCode = 2;
    return;
  }
  const [protocol, trials] = await Promise.all([
    fs.readFile(protocolPath, "utf8").then(JSON.parse),
    fs.readFile(resultsPath, "utf8").then(JSON.parse)
  ]);
  const report = scoreNameSenseBenchmark(protocol, trials);
  console.log(formatNameSenseBenchmarkReport(report));
  if (!report.releaseReady) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
