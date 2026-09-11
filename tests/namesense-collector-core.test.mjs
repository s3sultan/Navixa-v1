import assert from "node:assert/strict";
import test from "node:test";
import { analyzeNameSenseSignal, createControlledLiveNameSenseTrial } from "../benchmarks/namesense/collector-core.mjs";

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
