import assert from "node:assert/strict";
import test from "node:test";

import {
  canReadMemory,
  isExpiredMemory,
  normalizeMemoryWrite,
  shouldRejectMemoryWrite,
} from "../lib/ai/memory/policy.ts";
import { retrieveMemories } from "../lib/ai/memory/retrieval.ts";
import type { NavixaMemory } from "../lib/ai/memory/types.ts";

const base: NavixaMemory = {
  id: "m1",
  userId: "u1",
  project: "kids",
  kind: "preference",
  content: "يفضل الشرح المختصر",
  source: "explicit_user",
  sensitivity: "standard",
  confidence: 1,
  salience: 0.8,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  expiresAt: null,
};

test("memory is isolated by user and project", () => {
  assert.equal(canReadMemory(base, "u1", "kids"), true);
  assert.equal(canReadMemory(base, "u2", "kids"), false);
  assert.equal(canReadMemory(base, "u1", "fitness"), false);
});

test("core memory can be shared into a child project only when allowed", () => {
  const core = { ...base, project: "core" as const };
  assert.equal(canReadMemory(core, "u1", "learning", true), true);
  assert.equal(canReadMemory(core, "u1", "learning", false), false);
});

test("expired memories are excluded", () => {
  const expired = { ...base, expiresAt: "2026-08-01T00:00:00.000Z" };
  assert.equal(isExpiredMemory(expired, new Date("2026-09-01T00:00:00.000Z")), true);
  assert.deepEqual(
    retrieveMemories([expired], {
      userId: "u1",
      project: "kids",
      now: "2026-09-01T00:00:00.000Z",
    }),
    [],
  );
});

test("assistant cannot infer common secrets into memory", () => {
  assert.equal(
    shouldRejectMemoryWrite({
      userId: "u1",
      project: "core",
      kind: "context",
      content: "api_key = abc123",
      source: "assistant_inferred",
    }),
    true,
  );
});

test("writes are normalized and confidence is bounded", () => {
  const value = normalizeMemoryWrite({
    userId: "u1",
    project: "core",
    kind: "context",
    content: "  تذكير   مؤقت  ",
    source: "assistant_inferred",
    confidence: 4,
  });

  assert.equal(value.content, "تذكير مؤقت");
  assert.equal(value.confidence, 1);
  assert.ok(value.expiresAt);
});
