import assert from "node:assert/strict";
import test from "node:test";
import { buildMoyasarCheckout, normalizeMoyasarWebhook, tamaraAdapter } from "../app/billing/providers/index.ts";

test("Moyasar checkout deduplicates provider methods and preserves Apple Pay metadata", () => {
  const checkout = buildMoyasarCheckout({
    id: "intent_123",
    amount: 1900,
    currency: "SAR",
    description: "NAVIXA Plus",
    callbackUrl: "https://navixasa.com/plus/complete?intent=intent_123",
    metadata: { navixa_intent: "intent_123" },
  }, "pk_live_safe", ["mada", "visa", "mastercard", "applepay"]);
  assert.equal(checkout.provider, "moyasar");
  assert.deepEqual(checkout.methods, ["creditcard", "applepay"]);
  assert.equal(checkout.applePay?.country, "SA");
  assert.equal(checkout.metadata.navixa_intent, "intent_123");
});

test("Moyasar webhook normalization rejects a wrong secret and normalizes a paid event", () => {
  const body = { id: "evt_123", type: "payment_paid", secret_token: "expected", data: { id: "pay_123", amount: 1900, currency: "SAR", metadata: { navixa_intent: "intent_123" } } };
  assert.equal(normalizeMoyasarWebhook({ body, expectedSecret: "wrong" }), null);
  const event = normalizeMoyasarWebhook({ body, expectedSecret: "expected" });
  assert.ok(event);
  assert.equal(event.provider, "moyasar");
  assert.equal(event.paid, true);
  assert.equal(event.intentId, "intent_123");
  assert.equal(event.paymentId, "pay_123");
});

test("Tamara remains disabled unless an administrator enables it and sandbox secrets are present", () => {
  const missing = tamaraAdapter.readiness({ NAVIXA_TAMARA_ENABLED: "true" });
  assert.equal(missing.enabled, false);
  assert.deepEqual(missing.missingSecrets, ["TAMARA_API_URL", "TAMARA_TEST_API_TOKEN", "TAMARA_WEBHOOK_SECRET"]);
  const ready = tamaraAdapter.readiness({ NAVIXA_TAMARA_ENABLED: "true", TAMARA_API_URL: "https://api.tamara.test", TAMARA_TEST_API_TOKEN: "test_token", TAMARA_WEBHOOK_SECRET: "webhook_secret" });
  assert.equal(ready.enabled, true);
  assert.equal(ready.mode, "sandbox");
});
