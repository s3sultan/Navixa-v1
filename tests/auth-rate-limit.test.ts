import assert from "node:assert/strict";
import test from "node:test";
import { clientIp, consumeAuthRateLimit } from "../worker/authRateLimit.ts";

type Row = { attempts: number; expiresAt: string };

function database() {
  const rows = new Map<string, Row>();
  return {
    rows,
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...next: unknown[]) { values = next; return statement; },
        async run() {
          if (sql.startsWith("INSERT INTO navixa_auth_rate_limits")) {
            const [key, expiresAt] = values as [string, string];
            const current = rows.get(key);
            rows.set(key, { attempts: (current?.attempts || 0) + 1, expiresAt });
          } else if (sql.startsWith("DELETE FROM navixa_auth_rate_limits")) {
            const cutoff = String(values[0]);
            for (const [key, row] of rows) if (row.expiresAt < cutoff) rows.delete(key);
          }
          return {};
        },
        async all<T = Record<string, unknown>>() {
          if (sql.startsWith("SELECT attempts FROM navixa_auth_rate_limits")) {
            const row = rows.get(String(values[0]));
            return { results: row ? [{ attempts: row.attempts }] as T[] : [] };
          }
          return { results: [] as T[] };
        },
      };
      return statement;
    },
  };
}

test("clientIp prefers Cloudflare address and normalizes forwarded address", () => {
  assert.equal(clientIp(new Request("https://navixa.example", { headers: { "cf-connecting-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.4, 10.0.0.1" } })), "203.0.113.8");
  assert.equal(clientIp(new Request("https://navixa.example", { headers: { "x-forwarded-for": "198.51.100.4, 10.0.0.1" } })), "198.51.100.4");
});

test("auth rate limit persists attempts in the shared database bucket", async () => {
  const db = database();
  const results = [];
  for (let index = 0; index < 4; index += 1) results.push(await consumeAuthRateLimit(db, "otp-request-email", "person@example.com", "pepper", 3, 600_000));
  assert.equal(results[0].allowed, true);
  assert.equal(results[2].allowed, true);
  assert.equal(results[3].allowed, false);
  assert.equal(results[3].attempts, 4);
  assert.equal(db.rows.size, 1);
});
