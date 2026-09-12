import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/admin/namesense-benchmark/invites/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/admin/namesense-benchmark/invites/page.tsx", import.meta.url), "utf8");
const protocol = JSON.parse(readFileSync(new URL("../benchmarks/namesense/protocol.json", import.meta.url), "utf8")) as {
  requiredAccents: Array<{ id: string }>;
  minimums: {
    speakersPerAccent: number;
    positiveTrialsPerAccent: number;
    negativeTrialsPerAccent: number;
  };
};

test("human rollout matrix requires nine accents and 1000 trials from at least 25 speakers per accent", () => {
  assert.equal(protocol.requiredAccents.length, 9);
  assert.equal(protocol.minimums.speakersPerAccent, 25);
  assert.equal(protocol.minimums.positiveTrialsPerAccent, 500);
  assert.equal(protocol.minimums.negativeTrialsPerAccent, 500);
  assert.equal(protocol.minimums.positiveTrialsPerAccent + protocol.minimums.negativeTrialsPerAccent, 1000);
  assert.equal(protocol.requiredAccents.length * 1000, 9000);
});

test("batch invite creation is bounded and cleans partial batches before returning an error", () => {
  assert.match(route, /count\s*=\s*Number\(body\.count\s*\?\?\s*1\)/);
  assert.match(route, /count\s*<\s*1\s*\|\|\s*count\s*>\s*25/);
  assert.match(route, /for \(let index = 0; index < count; index \+= 1\)/);
  assert.match(route, /DELETE FROM navixa_namesense_study_invites WHERE invite_id=\?/);
  assert.match(route, /لم تُعتمد دفعة جزئية/);
  assert.match(route, /invites:\s*createdInvites/);
  assert.match(route, /LIMIT 500/);
});

test("batch responses keep raw invite tokens fragment-only and the admin export stays browser-local", () => {
  assert.match(route, /invitePath:\s*`\/namesense-study#invite=\$\{token\}`/);
  assert.doesNotMatch(route, /namesense-study\?invite=/);
  assert.match(page, /count:\s*participantCount/);
  assert.match(page, /TARGET_SPEAKERS_PER_ACCENT\s*=\s*25/);
  assert.match(page, /text\/csv;charset=utf-8/);
  assert.match(page, /URL\.createObjectURL/);
  assert.match(page, /URL\.revokeObjectURL/);
  assert.doesNotMatch(page, /localStorage\.setItem\([^\n]*newLinks/);
});

test("recruitment target only counts participants who actually completed forty trials", () => {
  assert.match(page, /invite\.max_trials\s*>=\s*40\s*&&\s*invite\.used_trials\s*>=\s*40/);
  assert.match(page, /أكملوا 40 جولة/);
});
