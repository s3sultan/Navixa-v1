import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/billing/webhooks/salla/route.ts";

type FakeResponse = { results: Array<Record<string, unknown>> };
type QueryLog = { sql: string; values: unknown[] };

function runtimeEnv() {
  return globalThis as unknown as { SALLA_WEBHOOK_ENABLED?: string; SALLA_WEBHOOK_SECRET?: string; DB?: unknown };
}

async function signedRequest(raw: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw))), byte => byte.toString(16).padStart(2, "0")).join("");
  return new Request("https://navixasa.com/api/billing/webhooks/salla", { method: "POST", headers: { "x-salla-signature": signature }, body: raw });
}

function fakeDatabase(resolver: (sql: string) => FakeResponse) {
  const queries: QueryLog[] = [];
  return {
    queries,
    database: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            queries.push({ sql, values });
            return {
              all: async () => resolver(sql),
              run: async () => ({}),
            };
          },
          all: async () => resolver(sql),
          run: async () => ({}),
        };
      },
    },
  };
}

function withRuntime(values: { enabled?: string; secret?: string; db?: unknown }) {
  const env = runtimeEnv();
  const original = { enabled: env.SALLA_WEBHOOK_ENABLED, secret: env.SALLA_WEBHOOK_SECRET, db: env.DB };
  env.SALLA_WEBHOOK_ENABLED = values.enabled;
  env.SALLA_WEBHOOK_SECRET = values.secret;
  env.DB = values.db;
  return () => {
    env.SALLA_WEBHOOK_ENABLED = original.enabled;
    env.SALLA_WEBHOOK_SECRET = original.secret;
    env.DB = original.db;
  };
}

test("Webhook سلة مغلق افتراضيًا قبل إعداد السر وتشغيله", async () => {
  const restore = withRuntime({ enabled: "false" });
  try {
    const response = await POST(new Request("https://navixasa.com/api/billing/webhooks/salla", { method: "POST" }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally { restore(); }
});

test("Webhook سلة يسجل الحدث بإدراج ذري ولا ينشئ جدولًا أو استحقاقًا أثناء الاستقبال", async () => {
  const store = fakeDatabase(() => ({ results: [{ payload_hash: "accepted" }] }));
  const restore = withRuntime({ enabled: "true", secret: "local-test-secret", db: store.database });
  try {
    const raw = '{"id":"evt_accepted_1","event":"order.payment.updated","data":{"id":41013139}}';
    const response = await POST(await signedRequest(raw, "local-test-secret"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, recorded: true, entitlement: "not_activated" });
    assert.equal(store.queries.length, 1);
    assert.match(store.queries[0].sql, /INSERT INTO navixa_salla_events/);
    assert.match(store.queries[0].sql, /ON CONFLICT\(provider_event_key\) DO NOTHING/);
    assert.doesNotMatch(store.queries[0].sql, /CREATE TABLE/);
  } finally { restore(); }
});

test("Webhook سلة يستعمل fallback process.env المتوافق مع nodejs_compat عند غياب binding الاختبارات", async () => {
  const store = fakeDatabase(() => ({ results: [{ payload_hash: "accepted" }] }));
  const runtime = runtimeEnv();
  const original = {
    enabled: runtime.SALLA_WEBHOOK_ENABLED,
    secret: runtime.SALLA_WEBHOOK_SECRET,
    database: runtime.DB,
    processEnabled: process.env.SALLA_WEBHOOK_ENABLED,
    processSecret: process.env.SALLA_WEBHOOK_SECRET,
  };
  delete runtime.SALLA_WEBHOOK_ENABLED;
  delete runtime.SALLA_WEBHOOK_SECRET;
  runtime.DB = store.database;
  process.env.SALLA_WEBHOOK_ENABLED = "true";
  process.env.SALLA_WEBHOOK_SECRET = "process-env-test-secret";
  try {
    const raw = '{"id":"evt_process_env_1","event":"order.created","data":{"id":"nonfinancial-order"}}';
    const response = await POST(await signedRequest(raw, "process-env-test-secret"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, recorded: true, entitlement: "not_activated" });
  } finally {
    runtime.SALLA_WEBHOOK_ENABLED = original.enabled;
    runtime.SALLA_WEBHOOK_SECRET = original.secret;
    runtime.DB = original.database;
    if (original.processEnabled === undefined) delete process.env.SALLA_WEBHOOK_ENABLED;
    else process.env.SALLA_WEBHOOK_ENABLED = original.processEnabled;
    if (original.processSecret === undefined) delete process.env.SALLA_WEBHOOK_SECRET;
    else process.env.SALLA_WEBHOOK_SECRET = original.processSecret;
  }
});

test("Webhook سلة يرفض تعارض بصمة الحمولة لنفس معرف الحدث", async () => {
  const store = fakeDatabase(sql => ({ results: sql.startsWith("SELECT") ? [{ payload_hash: "other-payload" }] : [] }));
  const restore = withRuntime({ enabled: "true", secret: "local-test-secret", db: store.database });
  try {
    const raw = '{"id":"evt_accepted_1","event":"order.payment.updated","data":{"id":41013139}}';
    const response = await POST(await signedRequest(raw, "local-test-secret"));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "Conflicting Salla event payload" });
  } finally { restore(); }
});
