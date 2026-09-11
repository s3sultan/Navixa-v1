import assert from "node:assert/strict";
import test from "node:test";
import {
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
