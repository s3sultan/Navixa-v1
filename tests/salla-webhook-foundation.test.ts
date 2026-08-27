import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { buildSallaReturnUrl, fixedTimeEqualHex, parseSallaReturnIntent, verifySallaWebhookSignature } from "../app/billing/providers/salla.ts";

test("يتحقق من توقيع Salla HMAC المبني من الـ raw body", async () => {
  const rawBody = '{"event":"order.payment.updated","data":{"id":42}}';
  const secret = "salla-test-only-secret";
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
  assert.equal(await verifySallaWebhookSignature({ rawBody, secret, signature }), true);
});

test("يرفض body المعدل والتوقيع غير الصحيح قبل أي تسوية", async () => {
  const secret = "salla-test-only-secret";
  const signature = createHmac("sha256", secret).update('{"status":"paid"}').digest("hex");
  assert.equal(await verifySallaWebhookSignature({ rawBody: '{"status":"failed"}', secret, signature }), false);
  assert.equal(await verifySallaWebhookSignature({ rawBody: "{}", secret, signature: "not-a-signature" }), false);
});

test("يبني رابط عودة لا يتضمن نجاح الدفع أو بريد العميل", () => {
  const intentId = "billing_intent_8NHzyx5q6x9e1C2d";
  const url = new URL(buildSallaReturnUrl("https://navixasa.com", intentId));
  assert.equal(url.pathname, "/plus/complete");
  assert.equal(url.searchParams.get("intent"), intentId);
  assert.equal(url.searchParams.get("provider"), "salla");
  assert.equal(url.searchParams.has("status"), false);
  assert.equal(url.searchParams.has("email"), false);
  assert.equal(parseSallaReturnIntent(intentId), intentId);
  assert.equal(parseSallaReturnIntent("paid"), null);
});

test("مقارنة التوقيع ثابتة الطول وترفض أي اختلاف", () => {
  assert.equal(fixedTimeEqualHex("a".repeat(64), "a".repeat(64)), true);
  assert.equal(fixedTimeEqualHex("a".repeat(64), `${"a".repeat(63)}b`), false);
  assert.equal(fixedTimeEqualHex("a".repeat(64), "a".repeat(63)), false);
});
