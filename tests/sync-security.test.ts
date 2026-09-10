import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/sync/route.ts";
import { GET as accountSyncGET, PUT as accountSyncPUT } from "../app/api/account/sync/route.ts";
import { hashOpaqueValue } from "../worker/userAuth.ts";

const syncId = "a".repeat(32);
const syncKey = "b".repeat(48);

class FakeAccountSyncDb {
  sessions = new Map<string, { user_id: string; email: string; status: "active"; expires_at: string }>();
  sync = new Map<string, { version: number; payload: string; updated_at: string }>();

  prepare(sql: string) {
    const database = this;
    let values: unknown[] = [];
    return {
      bind(...nextValues: unknown[]) { values = nextValues; return this; },
      async all<T = Record<string, unknown>>() {
        if (sql.includes("FROM navixa_user_sessions s JOIN navixa_users u")) {
          const row = database.sessions.get(String(values[0] || ""));
          return { results: (row ? [row] : []) as T[] };
        }
        if (sql.includes("SELECT version,payload,updated_at FROM navixa_user_sync")) {
          const row = database.sync.get(String(values[0] || ""));
          return { results: (row ? [row] : []) as T[] };
        }
        if (sql.includes("SELECT version FROM navixa_user_sync")) {
          const row = database.sync.get(String(values[0] || ""));
          return { results: (row ? [{ version: row.version }] : []) as T[] };
        }
        throw new Error(`Unhandled fake D1 all(): ${sql}`);
      },
      async run() {
        if (sql.includes("INSERT INTO navixa_user_sync")) {
          const [userId, payload, updatedAt] = values.map(String);
          if (database.sync.has(userId)) throw new Error("UNIQUE constraint failed");
          database.sync.set(userId, { version: 1, payload, updated_at: updatedAt });
          return { meta: { changes: 1 } };
        }
        if (sql.includes("UPDATE navixa_user_sync SET payload=?,version=version+1")) {
          const [payload, updatedAt, userIdRaw, expectedVersionRaw] = values;
          const userId = String(userIdRaw || "");
          const expectedVersion = Number(expectedVersionRaw);
          const current = database.sync.get(userId);
          if (!current || current.version !== expectedVersion) return { meta: { changes: 0 } };
          database.sync.set(userId, { version: current.version + 1, payload: String(payload), updated_at: String(updatedAt) });
          return { meta: { changes: 1 } };
        }
        throw new Error(`Unhandled fake D1 run(): ${sql}`);
      },
    };
  }
}

async function installSession(db: FakeAccountSyncDb, token: string, userId: string, email: string) {
  db.sessions.set(await hashOpaqueValue(token), {
    user_id: userId,
    email,
    status: "active",
    expires_at: "2099-01-01T00:00:00.000Z",
  });
}

function accountRequest(token: string | null, method: "GET" | "PUT" = "GET", body?: Record<string, unknown>, origin = "https://navixa.example") {
  const headers = new Headers({ origin });
  if (token) headers.set("cookie", `__Host-navixa_session=${token}`);
  if (body) headers.set("content-type", "application/json");
  return new Request("https://navixa.example/api/account/sync", {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("secure sync rejects cross-origin writes before touching storage", async () => {
  const response = await POST(new Request("https://navixa.example/api/sync", {
    method: "POST",
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    body: JSON.stringify({ syncId, syncKey, payload: "{}" }),
  }));
  assert.equal(response.status, 403);
});

test("secure sync reads require an independent sync key", async () => {
  const response = await GET(new Request(`https://navixa.example/api/sync?syncId=${syncId}`, {
    headers: { origin: "https://navixa.example" },
  }));
  assert.equal(response.status, 400);
});

test("account sync rejects cross-origin writes before storage access", async () => {
  const response = await accountSyncPUT(accountRequest("x".repeat(48), "PUT", { payload: "{}", expectedVersion: 0 }, "https://evil.example"));
  assert.equal(response.status, 403);
});

test("account sync requires the existing NAVIXA OTP session", async () => {
  const db = new FakeAccountSyncDb();
  (globalThis as { DB?: unknown }).DB = db;
  try {
    const response = await accountSyncGET(accountRequest(null));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
  } finally {
    delete (globalThis as { DB?: unknown }).DB;
  }
});

test("account sync isolates users, returns pseudonymous scopes, and detects stale writes", async () => {
  const db = new FakeAccountSyncDb();
  const tokenA = "A".repeat(48);
  const tokenB = "B".repeat(48);
  await installSession(db, tokenA, "user-a", "a@example.com");
  await installSession(db, tokenB, "user-b", "b@example.com");
  (globalThis as { DB?: unknown }).DB = db;

  try {
    const firstWrite = await accountSyncPUT(accountRequest(tokenA, "PUT", { payload: JSON.stringify({ schema: 1, today: { tasks: [{ title: "A only", done: false }], academicReminders: [] } }), expectedVersion: 0 }));
    assert.equal(firstWrite.status, 200);
    assert.equal((await firstWrite.json()).version, 1);

    const readA = await accountSyncGET(accountRequest(tokenA));
    assert.equal(readA.status, 200);
    const aBody = await readA.json();
    assert.equal(aBody.found, true);
    assert.match(String(aBody.payload), /A only/);
    assert.match(String(aBody.scopeId), /^[a-f0-9]{32}$/);
    assert.notEqual(aBody.scopeId, "user-a");

    const readB = await accountSyncGET(accountRequest(tokenB));
    assert.equal(readB.status, 200);
    const bBody = await readB.json();
    assert.equal(bBody.found, false);
    assert.equal(bBody.payload, null);
    assert.match(String(bBody.scopeId), /^[a-f0-9]{32}$/);
    assert.notEqual(bBody.scopeId, aBody.scopeId);
    assert.notEqual(bBody.scopeId, "user-b");

    const staleWrite = await accountSyncPUT(accountRequest(tokenA, "PUT", { payload: "{\"schema\":1}", expectedVersion: 0 }));
    assert.equal(staleWrite.status, 409);
    const staleBody = await staleWrite.json();
    assert.equal(staleBody.conflict, true);
    assert.equal(staleBody.currentVersion, 1);

    const secondWrite = await accountSyncPUT(accountRequest(tokenA, "PUT", { payload: "{\"schema\":1}", expectedVersion: 1 }));
    assert.equal(secondWrite.status, 200);
    assert.equal((await secondWrite.json()).version, 2);
  } finally {
    delete (globalThis as { DB?: unknown }).DB;
  }
});

test("account sync rejects oversized payloads", async () => {
  const db = new FakeAccountSyncDb();
  const token = "C".repeat(48);
  await installSession(db, token, "user-c", "c@example.com");
  (globalThis as { DB?: unknown }).DB = db;
  try {
    const response = await accountSyncPUT(accountRequest(token, "PUT", { payload: "x".repeat(650_001), expectedVersion: 0 }));
    assert.equal(response.status, 413);
  } finally {
    delete (globalThis as { DB?: unknown }).DB;
  }
});
