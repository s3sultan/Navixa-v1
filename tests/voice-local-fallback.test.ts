import assert from "node:assert/strict";
import test from "node:test";
import {
  conditionNavixaVoiceAudio,
  hasNavixaVoiceActivity,
  resampleNavixaVoiceAudio,
  trimNavixaVoiceBuffer,
} from "../app/voice/localNameFallback.ts";

test("resamples local voice audio to the Whisper 16 kHz rate", () => {
  const sourceRate = 48_000;
  const input = new Float32Array(sourceRate);
  for (let index = 0; index < input.length; index += 1) input[index] = Math.sin(index / 30);
  const output = resampleNavixaVoiceAudio(input, sourceRate, 16_000);
  assert.equal(output.length, 16_000);
  assert.ok(output.some((sample) => Math.abs(sample) > 0.01));
});

test("copies audio when it is already at the target sample rate", () => {
  const input = new Float32Array([0.25, -0.5, 0.75]);
  const output = resampleNavixaVoiceAudio(input, 16_000, 16_000);
  assert.deepEqual([...output], [...input]);
  assert.notEqual(output, input);
});

test("detects sustained speech-like energy but rejects silence", () => {
  const sampleRate = 16_000;
  const speech = new Float32Array(sampleRate / 2);
  for (let index = 0; index < speech.length; index += 1) {
    speech[index] = Math.sin(2 * Math.PI * 180 * index / sampleRate) * 0.012;
  }
  assert.equal(hasNavixaVoiceActivity(new Float32Array(sampleRate / 2), sampleRate), false);
  assert.equal(hasNavixaVoiceActivity(speech, sampleRate), true);
});

test("does not treat one short click as speech", () => {
  const sampleRate = 16_000;
  const click = new Float32Array(sampleRate / 2);
  click[800] = 0.9;
  click[801] = -0.9;
  assert.equal(hasNavixaVoiceActivity(click, sampleRate), false);
});

test("keeps the voice gate sensitive to quiet sustained speech", () => {
  const sampleRate = 16_000;
  const quietSpeech = new Float32Array(sampleRate / 2);
  for (let index = 0; index < quietSpeech.length; index += 1) {
    quietSpeech[index] = Math.sin(2 * Math.PI * 140 * index / sampleRate) * 0.0055;
  }
  assert.equal(hasNavixaVoiceActivity(quietSpeech, sampleRate), true);
});

test("conditions quiet speech without clipping it", () => {
  const sampleRate = 16_000;
  const quietSpeech = new Float32Array(sampleRate / 2);
  for (let index = 0; index < quietSpeech.length; index += 1) {
    quietSpeech[index] = Math.sin(2 * Math.PI * 170 * index / sampleRate) * 0.008;
  }
  const conditioned = conditionNavixaVoiceAudio(quietSpeech);
  const inputPeak = Math.max(...quietSpeech.map((sample) => Math.abs(sample)));
  const outputPeak = Math.max(...conditioned.map((sample) => Math.abs(sample)));
  assert.equal(conditioned.length, quietSpeech.length);
  assert.ok(outputPeak > inputPeak);
  assert.ok(outputPeak <= 0.96);
});

test("removes DC offset before local transcription", () => {
  const sampleRate = 16_000;
  const biased = new Float32Array(sampleRate / 4);
  for (let index = 0; index < biased.length; index += 1) {
    biased[index] = 0.18 + Math.sin(2 * Math.PI * 190 * index / sampleRate) * 0.03;
  }
  const conditioned = conditionNavixaVoiceAudio(biased);
  const mean = conditioned.reduce((sum, sample) => sum + sample, 0) / conditioned.length;
  assert.ok(Math.abs(mean) < 0.001);
  assert.ok(conditioned.some((sample) => Math.abs(sample) > 0.02));
});

test("returns clean silence instead of amplifying numerical noise", () => {
  const input = new Float32Array(2_000);
  input[100] = Number.NaN;
  const conditioned = conditionNavixaVoiceAudio(input);
  assert.equal(conditioned.length, input.length);
  assert.ok(conditioned.every((sample) => sample === 0));
});

test("caps the in-memory rolling buffer instead of growing with lecture length", () => {
  const chunks = [
    new Float32Array(8_000),
    new Float32Array(8_000),
    new Float32Array(8_000),
    new Float32Array(8_000),
  ];
  const trimmed = trimNavixaVoiceBuffer(chunks, 16_000, 1);
  const samples = trimmed.reduce((sum, chunk) => sum + chunk.length, 0);
  assert.ok(samples <= 16_000);
});

test("rejects unusable source rates safely", () => {
  assert.equal(resampleNavixaVoiceAudio(new Float32Array([1, 2]), 0).length, 0);
  assert.equal(resampleNavixaVoiceAudio(new Float32Array(), 48_000).length, 0);
});
