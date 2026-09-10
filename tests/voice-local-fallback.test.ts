import assert from "node:assert/strict";
import test from "node:test";
import { resampleNavixaVoiceAudio, trimNavixaVoiceBuffer } from "../app/voice/localNameFallback.ts";

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
