import assert from "node:assert/strict";
import test from "node:test";

import { authorizeAiRequest } from "../lib/ai/gateway.ts";
import { canReadMemory, isExpiredMemory, normalizeMemoryWrite, shouldRejectMemoryWrite } from "../lib/ai/memory/policy.ts";
import { retrieveMemories } from "../lib/ai/memory/retrieval.ts";
import type { MemoryStore, NavixaMemory } from "../lib/ai/memory/types.ts";

const base: NavixaMemory = {
  id: "m1", userId: "u1", project: "kids", kind: "preference",
  content: "يفضل الشرح المختصر", source: "explicit_user", sensitivity: "standard",
  confidence: 1, salience: 0.8,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", expiresAt: null,
};

test("memory is isolated by user and project", () => {
  assert.equal(canReadMemory(base, "u1", "kids"), true);
  assert.equal(canReadMemory(base, "u2", "kids"), false);
  assert.equal(canReadMemory(base, "u1", "fitness"), false);
});

test("core memory sharing is explicit", () => {
  const core = { ...base, project: "core" as const };
  assert.equal(canReadMemory(core, "u1", "learning", true), true);
  assert.equal(canReadMemory(core, "u1", "learning", false), false);
});

test("meetings uses the canonical NAVIXA project scope", () => {
  const meeting = { ...base, project: "meetings" as const };
  assert.equal(canReadMemory(meeting, "u1", "meetings"), true);
  assert.equal(canReadMemory(meeting, "u1", "core"), false);
});

test("expired and restricted memories are excluded by default", () => {
  const expired = { ...base, expiresAt: "2026-08-01T00:00:00.000Z" };
  const restricted = { ...base, id: "m2", sensitivity: "restricted" as const };
  assert.equal(isExpiredMemory(expired, new Date("2026-09-01T00:00:00.000Z")), true);
  assert.deepEqual(retrieveMemories([expired, restricted], { userId: "u1", project: "kids", now: "2026-09-01T00:00:00.000Z" }), []);
  assert.equal(retrieveMemories([restricted], { userId: "u1", project: "kids", includeRestricted: true }).length, 1);
});

test("assistant cannot infer common secrets into memory", () => {
  assert.equal(shouldRejectMemoryWrite({ userId: "u1", project: "core", kind: "context", content: "api_key = abc123", source: "assistant_inferred" }), true);
});

test("writes are normalized and bounded", () => {
  const value = normalizeMemoryWrite({ userId: "u1", project: "core", kind: "context", content: "  تذكير   مؤقت  ", source: "assistant_inferred", confidence: 4 });
  assert.equal(value.content, "تذكير مؤقت");
  assert.equal(value.confidence, 1);
  assert.ok(value.expiresAt);
});

function emptyDb() {
  return {
    prepare() {
      return { bind() { return { async all<T>() { return { results: [] as T[] }; } }; } };
    },
  };
}

test("gateway keeps working when memory storage fails", async () => {
  const store: MemoryStore = {
    async list() { throw new Error("offline"); },
    async upsert() { throw new Error("unused"); }, async remove() {}, async clearProject() {},
  };
  const result = await authorizeAiRequest({
    db: emptyDb(), identity: { userId: "u1", email: "u1@example.test" },
    route: { project: "core", task: "chat", userPlan: "free" }, text: "رتب يومي",
    usage: { requestsToday: 0, tokensToday: 0 }, memory: { store },
  });
  assert.equal(result.allowed, true);
  if (result.allowed) assert.deepEqual(result.memories, []);
});

test("gateway rechecks memory isolation at its own boundary", async () => {
  const unsafe = { ...base, userId: "other-user", project: "core" as const };
  const store: MemoryStore = {
    async list() { return [unsafe]; },
    async upsert() { throw new Error("unused"); }, async remove() {}, async clearProject() {},
  };
  const result = await authorizeAiRequest({
    db: emptyDb(), identity: { userId: "u1", email: "u1@example.test" },
    route: { project: "kids", task: "explain", userPlan: "free" }, text: "اشرح الدرس",
    usage: { requestsToday: 0, tokensToday: 0 }, memory: { store },
  });
  assert.equal(result.allowed, true);
  if (result.allowed) assert.deepEqual(result.memories, []);
});
