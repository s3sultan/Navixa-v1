import assert from "node:assert/strict";
import test from "node:test";
import { claimWebhookEvent, processWebhookOnce, type StoredWebhookEvent, type WebhookEventStore } from "../app/billing/webhookIdempotency.ts";

const hash = (value: string) => value.repeat(64).slice(0, 64);

class MemoryStore implements WebhookEventStore {
  readonly rows = new Map<string, StoredWebhookEvent>();
  readonly marks: Array<{ key: string; status: string; code?: string }> = [];
  private key(provider: string, eventId: string) { return `${provider}:${eventId}`; }
  async insertIfAbsent(input: { provider: string; eventId: string; eventType: string; payloadHash: string; leaseUntil: string; receivedAt: string }) {
    const key = this.key(input.provider, input.eventId);
    if (this.rows.has(key)) return false;
    this.rows.set(key, { payloadHash: input.payloadHash, status: "processing", leaseUntil: input.leaseUntil });
    return true;
  }
  async get(provider: string, eventId: string) { return this.rows.get(this.key(provider, eventId)) ?? null; }
  async takeExpiredLease(input: { provider: string; eventId: string; now: string; leaseUntil: string }) {
    const row = this.rows.get(this.key(input.provider, input.eventId));
    if (!row || !row.leaseUntil || row.leaseUntil >= input.now || !["processing", "failed"].includes(row.status)) return false;
    row.status = "processing"; row.leaseUntil = input.leaseUntil; return true;
  }
  async mark(provider: string, eventId: string, status: "processed" | "rejected" | "failed", code?: string) {
    const key = this.key(provider, eventId); const row = this.rows.get(key);
    if (!row) throw new Error("missing row");
    row.status = status; row.leaseUntil = null; this.marks.push({ key, status, code });
  }
}

test("الطلبات المتزامنة لنفس الحدث تمنح معالجًا واحدًا فقط", async () => {
  const store = new MemoryStore();
  const claims = await Promise.all(Array.from({ length: 20 }, () => claimWebhookEvent(store, {
    provider: "moyasar", eventId: "evt_001", eventType: "payment_paid", payloadHash: hash("a"), now: new Date("2026-08-26T12:00:00Z"),
  })));
  assert.equal(claims.filter((claim) => claim === "owner").length, 1);
  assert.equal(claims.filter((claim) => claim === "busy").length, 19);
});

test("حدث الدفع المكرر بالتزامن لا يمنح الاستحقاق إلا مرة واحدة", async () => {
  const store = new MemoryStore(); let settlements = 0;
  const attempts = await Promise.all(Array.from({ length: 12 }, () => processWebhookOnce({
    store, provider: "moyasar", eventId: "payment:1942:paid", eventType: "payment_paid", payloadHash: hash("a"),
    verify: async () => true,
    settle: async () => { settlements += 1; },
  })));
  assert.equal(attempts.filter((result) => result.outcome === "processed").length, 1);
  assert.equal(settlements, 1);
  assert.ok(attempts.every((result) => result.httpStatus === 200 || result.httpStatus === 503));
});

test("الحدث المعالج يعيد duplicate ولا ينفذ settlement مرتين", async () => {
  const store = new MemoryStore(); let settlements = 0;
  const first = await processWebhookOnce({ store, provider: "moyasar", eventId: "evt_002", eventType: "payment_paid", payloadHash: hash("b"), verify: async () => true, settle: async () => { settlements++; } });
  const second = await processWebhookOnce({ store, provider: "moyasar", eventId: "evt_002", eventType: "payment_paid", payloadHash: hash("b"), verify: async () => true, settle: async () => { settlements++; } });
  assert.deepEqual(first, { httpStatus: 200, outcome: "processed" });
  assert.deepEqual(second, { httpStatus: 200, outcome: "duplicate" });
  assert.equal(settlements, 1);
});

test("نفس event ID مع payload مختلف لا يقبل للتسوية", async () => {
  const store = new MemoryStore();
  await claimWebhookEvent(store, { provider: "tap", eventId: "charge:001", eventType: "charge.CAPTURED", payloadHash: hash("c") });
  const result = await processWebhookOnce({ store, provider: "tap", eventId: "charge:001", eventType: "charge.CAPTURED", payloadHash: hash("d"), verify: async () => true, settle: async () => assert.fail("must not settle") });
  assert.deepEqual(result, { httpStatus: 200, outcome: "conflict" });
});

test("تعطل settlement يعيد 503 ولا ينشئ دفعة أو استحقاقًا جديدًا", async () => {
  const store = new MemoryStore(); let settlementAttempts = 0;
  const result = await processWebhookOnce({ store, provider: "moyasar", eventId: "evt_003", eventType: "payment_paid", payloadHash: hash("e"), verify: async () => true, settle: async () => { settlementAttempts++; throw new Error("D1 timeout"); } });
  assert.deepEqual(result, { httpStatus: 503, outcome: "retry" });
  assert.equal(settlementAttempts, 1);
  assert.deepEqual(store.marks.at(-1), { key: "moyasar:evt_003", status: "failed", code: "transient" });
});

test("فشل التحقق يرفض الحدث ولا يستدعي settlement", async () => {
  const store = new MemoryStore();
  const result = await processWebhookOnce({ store, provider: "moyasar", eventId: "evt_004", eventType: "payment_paid", payloadHash: hash("f"), verify: async () => false, settle: async () => assert.fail("must not settle") });
  assert.deepEqual(result, { httpStatus: 401, outcome: "rejected" });
  assert.deepEqual(store.marks.at(-1), { key: "moyasar:evt_004", status: "rejected", code: "verification_failed" });
});

test("بعد انتهاء lease يسمح الاستحواذ الآمن لإعادة التسليم", async () => {
  const store = new MemoryStore(); const start = new Date("2026-08-26T12:00:00Z");
  assert.equal(await claimWebhookEvent(store, { provider: "tap", eventId: "charge:002", eventType: "charge.CAPTURED", payloadHash: hash("1"), now: start }), "owner");
  assert.equal(await claimWebhookEvent(store, { provider: "tap", eventId: "charge:002", eventType: "charge.CAPTURED", payloadHash: hash("1"), now: new Date("2026-08-26T12:02:00Z") }), "owner");
});
