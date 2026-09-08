import assert from "node:assert/strict";
import test from "node:test";

import { authorizeAiRequest } from "../lib/ai/gateway.ts";
import { NavixaDbMemoryStore } from "../lib/ai/memory/db-store.ts";
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

test("credentials are never accepted into NAVIXA memory regardless of source", () => {
  assert.equal(shouldRejectMemoryWrite({ userId: "u1", project: "core", kind: "context", content: "api_key = abc123", source: "assistant_inferred" }), true);
  assert.equal(shouldRejectMemoryWrite({ userId: "u1", project: "core", kind: "context", content: "كلمة المرور هي abc123", source: "explicit_user" }), true);
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

type SqlCall = { sql: string; values: unknown[] };

function recordingMemoryDb(rows: Record<string, unknown>[] = []) {
  const calls: SqlCall[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async all<T>() { return { results: rows as T[] }; },
            async run() { return {}; },
          };
        },
      };
    },
  };
  return { db, calls };
}

test("database memory removal is always scoped to the owning user", async () => {
  const { db, calls } = recordingMemoryDb();
  const store = new NavixaDbMemoryStore(db);
  await store.remove("u1", "memory-123");
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /WHERE id=\? AND user_id=\?/);
  assert.deepEqual(calls[0].values, ["memory-123", "u1"]);
});

test("database project clearing cannot cross user or project boundaries", async () => {
  const { db, calls } = recordingMemoryDb();
  const store = new NavixaDbMemoryStore(db);
  await store.clearProject("u1", "learning");
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /WHERE user_id=\? AND project=\?/);
  assert.deepEqual(calls[0].values, ["u1", "learning"]);
});

test("database store rechecks returned rows instead of trusting the database adapter", async () => {
  const { db } = recordingMemoryDb([{
    id: "unsafe", user_id: "other-user", project: "core", kind: "context",
    content: "بيانات مستخدم آخر", source: "explicit_user", sensitivity: "standard",
    confidence: 1, salience: 1, created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z", expires_at: null,
  }]);
  const store = new NavixaDbMemoryStore(db);
  const result = await store.list({ userId: "u1", project: "kids" });
  assert.deepEqual(result, []);
});

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
