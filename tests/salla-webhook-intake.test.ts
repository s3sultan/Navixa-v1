import assert from "node:assert/strict";
import test from "node:test";
import { parseSallaWebhookEvent, sha256Hex } from "../app/billing/sallaWebhookEvent.ts";
import { verifySallaWebhookSignature } from "../app/billing/providers/salla.ts";

test("Salla intake derives a stable replay key for an identical raw delivery", async () => {
  const raw = '{"event":"order.payment.updated","data":{"id":41013139}}';
  const first = await parseSallaWebhookEvent(raw, JSON.parse(raw));
  const second = await parseSallaWebhookEvent(raw, JSON.parse(raw));
  assert.ok(first);
  assert.deepEqual(second, first);
  assert.equal(first.eventId, `order.payment.updated:41013139:${await sha256Hex(raw)}`);
});

test("Salla intake preserves a provider event id when supplied", async () => {
  const raw = '{"id":"evt_accepted_1","event":"order.payment.updated","data":{"id":41013139}}';
  const event = await parseSallaWebhookEvent(raw, JSON.parse(raw));
  assert.equal(event?.eventId, "evt_accepted_1");
});

test("Salla intake rejects malformed event metadata", async () => {
  const raw = '{"event":"order.payment.updated","data":{"id":"<script>"}}';
  assert.equal(await parseSallaWebhookEvent(raw, JSON.parse(raw)), null);
});

test("Salla signature verification accepts exact raw content only", async () => {
  const secret = "test-salla-secret";
  const raw = '{"event":"order.payment.updated","data":{"id":41013139}}';
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw))), byte => byte.toString(16).padStart(2, "0")).join("");
  assert.equal(await verifySallaWebhookSignature({ rawBody: raw, signature, secret }), true);
  assert.equal(await verifySallaWebhookSignature({ rawBody: `${raw} `, signature, secret }), false);
});
