import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/sync/route.ts";
import { hashOpaqueValue, USER_SESSION_COOKIE } from "../worker/userAuth.ts";

const syncId = "a".repeat(32);
const syncKey = "b".repeat(48);
const origin = "https://navixa.example";

type AccountRow = { payload: string; updated_at: string; version: number };
type SessionRow = { user_id: string; email: string; status: "active"; expires_at: string };

function createAccountSyncDb() {
  const sessions = new Map<string, SessionRow>();
  const accountRows = new Map<string, AccountRow>();

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
          if (normalized === "SELECT payload,updated_at,version FROM navixa_account_sync WHERE user_id=? LIMIT 1") {
            const row = accountRows.get(String(values[0]));
            return { results: (row ? [row] : []) as T[] };
          }
          throw new Error(`Unexpected all SQL: ${normalized}`);
        },
        async run() {
          if (normalized.startsWith("INSERT OR IGNORE INTO navixa_account_sync")) {
            const [userId, payload, updatedAt] = values.map(String);
            if (accountRows.has(userId)) return { meta: { changes: 0 } };
            accountRows.set(userId, { payload, updated_at: updatedAt, version: 1 });
            return { meta: { changes: 1 } };
          }
          if (normalized.startsWith("UPDATE navixa_account_sync SET payload=?")) {
            const userId = String(values[2]);
            const expectedVersion = Number(values[3]);
            const current = accountRows.get(userId);
            if (!current || current.version !== expectedVersion) return { meta: { changes: 0 } };
            accountRows.set(userId, { payload: String(values[0]), updated_at: String(values[1]), version: current.version + 1 });
            return { meta: { changes: 1 } };
          }
          if (normalized === "DELETE FROM navixa_account_sync WHERE user_id=?") {
            return { meta: { changes: accountRows.delete(String(values[0])) ? 1 : 0 } };
          }
          throw new Error(`Unexpected run SQL: ${normalized}`);
        },
      };
      return statement;
    },
  };

  return {
    database,
    accountRows,
    async addSession(token: string, userId: string, email = `${userId}@example.com`) {
      sessions.set(await hashOpaqueValue(token), {
        user_id: userId,
        email,
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

test("secure sync rejects cross-origin writes before touching storage", async () => {
  const response = await POST(new Request(`${origin}/api/sync`, {
    method: "POST",
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    body: JSON.stringify({ syncId, syncKey, payload: "{}" }),
  }));
  assert.equal(response.status, 403);
});

test("secure sync reads require an independent sync key without an account session", async () => {
  const response = await GET(new Request(`${origin}/api/sync?syncId=${syncId}`, {
    headers: { origin },
  }));
  assert.equal(response.status, 400);
});

test("account sync ownership comes only from the authenticated NAVIXA session", async () => {
  const store = createAccountSyncDb();
  const tokenA = "session-a-abcdefghijklmnopqrstuvwxyz-1234567890";
  const tokenB = "session-b-abcdefghijklmnopqrstuvwxyz-1234567890";
  await store.addSession(tokenA, "user-a");
  await store.addSession(tokenB, "user-b");
  (globalThis as typeof globalThis & { DB?: unknown }).DB = store.database;

  try {
    const save = await POST(accountRequest("/api/sync", tokenA, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: "encrypted-a", userId: "user-b", syncId, syncKey }),
    }));
    assert.equal(save.status, 200);
    assert.equal((await save.json()).mode, "account");
    assert.equal(store.accountRows.get("user-a")?.payload, "encrypted-a");
    assert.equal(store.accountRows.has("user-b"), false);

    const readA = await GET(accountRequest("/api/sync", tokenA));
    assert.equal(readA.status, 200);
    const payloadA = await readA.json();
    assert.equal(payloadA.found, true);
    assert.equal(payloadA.payload, "encrypted-a");
    assert.equal(readA.headers.get("cache-control"), "private, no-store");

    const readB = await GET(accountRequest("/api/sync", tokenB));
    assert.equal(readB.status, 200);
    const payloadB = await readB.json();
    assert.equal(payloadB.found, false);
    assert.equal(payloadB.payload, null);
  } finally {
    delete (globalThis as typeof globalThis & { DB?: unknown }).DB;
  }
});

test("an invalid account cookie returns 401 instead of falling back to legacy sync", async () => {
  const store = createAccountSyncDb();
  (globalThis as typeof globalThis & { DB?: unknown }).DB = store.database;
  const staleToken = "stale-session-abcdefghijklmnopqrstuvwxyz-1234567890";

  try {
    const response = await POST(accountRequest("/api/sync", staleToken, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ syncId, syncKey, payload: "encrypted-value" }),
    }));
    assert.equal(response.status, 401);
    assert.equal(store.accountRows.size, 0);
  } finally {
    delete (globalThis as typeof globalThis & { DB?: unknown }).DB;
  }
});

test("account sync rejects stale optimistic versions", async () => {
  const store = createAccountSyncDb();
  const token = "session-version-abcdefghijklmnopqrstuvwxyz-1234567890";
  await store.addSession(token, "user-version");
  (globalThis as typeof globalThis & { DB?: unknown }).DB = store.database;

  try {
    const first = await POST(accountRequest("/api/sync", token, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: "version-one" }),
    }));
    assert.equal(first.status, 200);
    assert.equal((await first.json()).version, 1);

    const conflict = await POST(accountRequest("/api/sync", token, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: "should-not-win", expectedVersion: 9 }),
    }));
    assert.equal(conflict.status, 409);
    assert.equal(store.accountRows.get("user-version")?.payload, "version-one");
  } finally {
    delete (globalThis as typeof globalThis & { DB?: unknown }).DB;
  }
});
