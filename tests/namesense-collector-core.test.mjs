import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeNameSenseSignal,
  createControlledLiveNameSenseTrial,
  deriveNameSenseAdaptiveVadThreshold,
  isNameSenseNoiseFloorCandidate,
} from "../benchmarks/namesense/collector-core.mjs";

const protocol = {
  requiredProvenance: "controlled-live",
  requiredCaptureMethod: "live-microphone",
  signalQuality: { minRms: 0.0035, minVariance: 1e-6, minActiveSpeechMs: 80, frameMs: 20 }
};

const makeSpeech = (sampleRate = 16_000, seconds = 0.5) => {
  const samples = new Float32Array(Math.round(sampleRate * seconds));
  for (let i = 0; i < samples.length; i += 1) samples[i] = 0.025 * Math.sin(2 * Math.PI * 180 * i / sampleRate);
  return samples;
};

test("client-side signal validation rejects silence before a trial can be committed", () => {
  const silence = new Float32Array(16_000);
  const quality = analyzeNameSenseSignal(silence, 16_000, protocol.signalQuality);
  assert.equal(quality.passed, false);
  assert.equal(quality.vadSpeechConfirmed, false);
  assert.throws(() => createControlledLiveNameSenseTrial({ audio: silence, sampleRate: 16_000, protocol, trial: { consent: true } }), /signal-quality-check-failed/);
});

test("client-side signal validation accepts sustained speech-like energy and discards raw audio from the record", () => {
  const audio = makeSpeech();
  const quality = analyzeNameSenseSignal(audio, 16_000, protocol.signalQuality);
  assert.equal(quality.passed, true);
  const record = createControlledLiveNameSenseTrial({
    audio,
    sampleRate: 16_000,
    protocol,
    trial: { id: "trial-1", consent: true, expected: "hit", detected: true }
  });
  assert.equal(record.rawAudioRetained, false);
  assert.equal(record.signalQualityPassed, true);
  assert.equal(record.vadSpeechConfirmed, true);
  assert.ok(record.signalRms >= protocol.signalQuality.minRms);
  assert.equal("audio" in record, false);
});

test("collector uses the current protocol thresholds rather than any stale quality verdict", () => {
  const audio = makeSpeech();
  const strictProtocol = {
    ...protocol,
    signalQuality: { ...protocol.signalQuality, minRms: 0.05 }
  };
  const quality = analyzeNameSenseSignal(audio, 16_000, strictProtocol.signalQuality);
  assert.equal(quality.passed, false);
  assert.throws(() => createControlledLiveNameSenseTrial({
    audio,
    sampleRate: 16_000,
    protocol: strictProtocol,
    trial: { id: "strict-threshold", consent: true, expected: "hit", detected: false }
  }), /signal-quality-check-failed/);
});

test("adaptive benchmark VAD stays inside conservative bounds", () => {
  assert.equal(deriveNameSenseAdaptiveVadThreshold(0, 0.0035), 0.0035);
  assert.equal(deriveNameSenseAdaptiveVadThreshold(0.001, 0.0035), 0.0035);
  assert.ok(deriveNameSenseAdaptiveVadThreshold(0.004, 0.0035) > 0.0035);
  assert.equal(deriveNameSenseAdaptiveVadThreshold(0.5, 0.0035), 0.01);
});

test("speech-like or transient frames cannot poison the benchmark noise floor", () => {
  assert.equal(isNameSenseNoiseFloorCandidate(0.002, 0.0035), true);
  assert.equal(isNameSenseNoiseFloorCandidate(0.006, 0.0035), true);
  assert.equal(isNameSenseNoiseFloorCandidate(0.012, 0.0035), false);
  assert.equal(isNameSenseNoiseFloorCandidate(0.05, 0.0035), false);
});
