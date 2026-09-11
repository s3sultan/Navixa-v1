import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET, POST } from "../app/api/automation-runs/route.ts";
import { hashOpaqueValue, USER_SESSION_COOKIE } from "../worker/userAuth.ts";

const origin = "https://navixa.example";
const root = new URL("../", import.meta.url);

type SessionRow = { user_id: string; email: string; status: "active"; expires_at: string };
type RunRow = {
  user_id: string;
  id: string;
  automation_id: string;
  automation_name: string;
  skill_id: string;
  trigger_type: "manual" | "schedule" | "event";
  trigger_value: string;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";
  started_at: string;
  completed_at: string;
  session_ref: string;
  part_ref: string;
  source: string;
  persisted_at: string;
};

function createRunHistoryDb() {
  const sessions = new Map<string, SessionRow>();
  const runs = new Map<string, RunRow>();
  const database = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      let values: unknown[] = [];
      const statement = {
        bind(...next: unknown[]) { values = next; return statement; },
        async all<T = Record<string, unknown>>() {
          if (normalized.startsWith("SELECT s.user_id,u.email,u.status,s.expires_at FROM navixa_user_sessions")) {
            const row = sessions.get(String(values[0]));
            return { results: (row ? [row] : []) as T[] };
          }
          if (normalized.startsWith("SELECT id,automation_id,automation_name,skill_id,trigger_type")) {
            const [userId, automationId, , skillId, , status, , limitRaw] = values;
            const limit = Number(limitRaw);
            const rows = [...runs.values()]
              .filter((row) => row.user_id === String(userId))
              .filter((row) => !automationId || row.automation_id === String(automationId))
              .filter((row) => !skillId || row.skill_id === String(skillId))
              .filter((row) => !status || row.status === String(status))
              .sort((a, b) => b.started_at.localeCompare(a.started_at))
              .slice(0, limit)
              .map(({ user_id: _userId, persisted_at: _persistedAt, ...row }) => row);
            return { results: rows as T[] };
          }
          throw new Error(`Unexpected all SQL: ${normalized}`);
        },
        async run() {
          if (normalized.startsWith("INSERT INTO navixa_automation_runs")) {
            const [userId, id, automationId, automationName, skillId, triggerType, triggerValue, status, startedAt, completedAt, sessionRef, partRef, source, persistedAt] = values.map(String);
            runs.set(`${userId}:${id}`, {
              user_id: userId,
              id,
              automation_id: automationId,
              automation_name: automationName,
              skill_id: skillId,
              trigger_type: triggerType as RunRow["trigger_type"],
              trigger_value: triggerValue,
              status: status as RunRow["status"],
              started_at: startedAt,
              completed_at: completedAt,
              session_ref: sessionRef,
              part_ref: partRef,
              source,
              persisted_at: persistedAt,
            });
            return { meta: { changes: 1 } };
          }
          throw new Error(`Unexpected run SQL: ${normalized}`);
        },
      };
      return statement;
    },
  };

  return {
    database,
    runs,
    async addSession(token: string, userId: string) {
      sessions.set(await hashOpaqueValue(token), {
        user_id: userId,
        email: `${userId}@example.com`,
        status: "active",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
    },
  };
}

function accountRequest(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", `${USER_SESSION_COOKIE}=${token}`);
  if (init.method && init.method !== "GET") headers.set("origin", origin);
  return new Request(`${origin}${path}`, { ...init, headers });
}

function runPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-12345678",
    automationId: "meeting.summary.after-transcription",
    automationName: "Summarize completed meeting transcript",
    skillId: "meeting.summary.local",
    triggerType: "event",
    triggerValue: "meeting.transcription.completed",
    status: "succeeded",
    startedAt: "2026-09-11T02:00:00.000Z",
    completedAt: "2026-09-11T02:00:01.000Z",
    sessionRef: "session-123",
    partRef: "part-456",
    source: "transcription",
    ...overrides,
  };
}

test("automation run migration stores only bounded operational metadata", async () => {
  const migration = await readFile(new URL("migrations/0051_automation_run_history.sql", root), "utf8");
  const table = migration.slice(migration.indexOf("CREATE TABLE"), migration.indexOf("CREATE INDEX"));
  assert.match(table, /user_id TEXT NOT NULL/);
  assert.match(table, /PRIMARY KEY \(user_id, id\)/);
  assert.match(table, /FOREIGN KEY \(user_id\) REFERENCES navixa_users\(id\) ON DELETE CASCADE/);
  assert.doesNotMatch(table, /\binput\b|\boutput\b|\btranscript\b|\bsummary\b|\berror\b|metadata_json|payload/i);
});

test("automation run writes require same-origin authenticated NAVIXA session", async () => {
  const crossOrigin = await POST(new Request(`${origin}/api/automation-runs`, {
    method: "POST",
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    body: JSON.stringify(runPayload()),
  }));
  assert.equal(crossOrigin.status, 403);

  const store = createRunHistoryDb();
  (globalThis as typeof globalThis & { DB?: unknown }).DB = store.database;
  try {
    const anonymous = await POST(new Request(`${origin}/api/automation-runs`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(runPayload()),
    }));
    assert.equal(anonymous.status, 401);
  } finally {
    delete (globalThis as typeof globalThis & { DB?: unknown }).DB;
  }
});

test("automation run ownership is derived server-side and sensitive content is rejected", async () => {
  const store = createRunHistoryDb();
  const token = "run-history-session-abcdefghijklmnopqrstuvwxyz-123456";
  await store.addSession(token, "user-a");
  (globalThis as typeof globalThis & { DB?: unknown }).DB = store.database;

  try {
    const saved = await POST(accountRequest("/api/automation-runs", token, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...runPayload(), userId: "user-b" }),
    }));
    assert.equal(saved.status, 200);
    assert.ok(store.runs.has("user-a:run-12345678"));
    assert.equal(store.runs.has("user-b:run-12345678"), false);

    for (const forbidden of ["input", "output", "error", "transcript", "summary", "metadata", "credentials", "stack"]) {
      const rejected = await POST(accountRequest("/api/automation-runs", token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...runPayload({ id: `run-${forbidden}-12345678` }), [forbidden]: "private-value" }),
      }));
      assert.equal(rejected.status, 400, forbidden);
    }
  } finally {
    delete (globalThis as typeof globalThis & { DB?: unknown }).DB;
  }
});

test("automation run reads remain isolated to the authenticated user", async () => {
  const store = createRunHistoryDb();
  const tokenA = "run-history-a-abcdefghijklmnopqrstuvwxyz-1234567890";
  const tokenB = "run-history-b-abcdefghijklmnopqrstuvwxyz-1234567890";
  await store.addSession(tokenA, "user-a");
  await store.addSession(tokenB, "user-b");
  (globalThis as typeof globalThis & { DB?: unknown }).DB = store.database;

  try {
    await POST(accountRequest("/api/automation-runs", tokenA, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(runPayload({ id: "run-user-a-12345678", partRef: "part-a" })),
    }));
    await POST(accountRequest("/api/automation-runs", tokenB, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(runPayload({ id: "run-user-b-12345678", partRef: "part-b" })),
    }));

    const response = await GET(accountRequest("/api/automation-runs?skillId=meeting.summary.local&limit=50", tokenA));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json() as { runs: Array<Record<string, unknown>> };
    assert.equal(body.runs.length, 1);
    assert.equal(body.runs[0]?.id, "run-user-a-12345678");
    assert.deepEqual(body.runs[0]?.metadata, { sessionId: "session-123", partId: "part-a", source: "transcription" });
    assert.equal("input" in body.runs[0]!, false);
    assert.equal("output" in body.runs[0]!, false);
    assert.equal("error" in body.runs[0]!, false);
  } finally {
    delete (globalThis as typeof globalThis & { DB?: unknown }).DB;
  }
});
