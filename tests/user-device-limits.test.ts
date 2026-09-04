import assert from "node:assert/strict";
import test from "node:test";
import { createUserSession, hashOpaqueValue, refreshUserSessionIfNeeded, resolveUserDeviceClass, USER_SESSION_COOKIE } from "../worker/userAuth.ts";

type Recorded = { sql: string; values: unknown[] };

function database(records: Recorded[]) {
  return {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...next: unknown[]) { values = next; return statement; },
        async all<T = Record<string, unknown>>() { return { results: [] as T[] }; },
        async run() { records.push({ sql, values }); return {}; },
      };
      return statement;
    },
  };
}

test("device classification distinguishes computer and mobile clients", () => {
  const computer = new Request("https://navixa.example", { headers: { "sec-ch-ua-mobile": "?0", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
  const mobile = new Request("https://navixa.example", { headers: { "sec-ch-ua-mobile": "?1", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile" } });
  assert.equal(resolveUserDeviceClass(computer), "computer");
  assert.equal(resolveUserDeviceClass(mobile), "mobile");
});

test("creating a session revokes only the previous active session in the same device class", async () => {
  const records: Recorded[] = [];
  const db = database(records);
  const request = new Request("https://navixa.example", { headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile" } });
  const session = await createUserSession(db, "user-1", request);
  assert.equal(session.deviceClass, "mobile");
  assert.equal(records.length, 2);
  assert.match(records[0].sql, /UPDATE navixa_user_sessions SET revoked_at=/);
  assert.deepEqual(records[0].values.slice(1), ["user-1", "mobile"]);
  assert.match(records[1].sql, /INSERT INTO navixa_user_sessions/);
  assert.equal(records[1].values.at(-1), "mobile");
});

test("sliding session refresh rotates the bearer token instead of extending the old token", async () => {
  const records: Recorded[] = [];
  const db = database(records);
  const oldToken = "old-session-token-that-is-long-enough-for-navixa";
  const request = new Request("https://navixa.example/api/account/session", { headers: { cookie: `${USER_SESSION_COOKIE}=${oldToken}` } });
  const refreshed = await refreshUserSessionIfNeeded(request, db, {
    userId: "user-1",
    email: "person@example.com",
    status: "active",
    expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
  });

  assert.equal(records.length, 1);
  assert.match(records[0].sql, /SET expires_at=\?,last_seen_at=\?,token_hash=\?/);
  assert.equal(records[0].values[3], await hashOpaqueValue(oldToken));
  assert.ok(refreshed.cookie);
  const nextToken = refreshed.cookie!.match(new RegExp(`${USER_SESSION_COOKIE}=([^;]+)`))?.[1] || "";
  assert.ok(nextToken.length >= 30);
  assert.notEqual(nextToken, oldToken);
  assert.equal(records[0].values[2], await hashOpaqueValue(nextToken));
});
