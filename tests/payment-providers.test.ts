import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildMoyasarCheckout, buildTelrHostedPaymentRequest, normalizeMoyasarWebhook, tamaraAdapter, telrAdapter } from "../app/billing/providers/index.ts";

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

test("live Moyasar webhook verifies amount, currency, intent, and paid status with Moyasar before activation", async () => {
  const route = await readFile(new URL("../app/api/billing/webhook/route.ts", import.meta.url), "utf8");
  assert.match(route, /verifyMoyasarPayment/);
  assert.match(route, /normalized\.amount !== intent\.amount/);
  assert.match(route, /normalized\.currency !== intent\.currency/);
  assert.match(route, /expectedIntentId:\s*intentId/);
  assert.match(route, /expectedAmount:\s*intent\.amount/);
  assert.match(route, /expectedCurrency:\s*intent\.currency/);
  assert.match(route, /verified\.status !== "paid"/);
});

test("Tamara remains disabled unless an administrator enables it and sandbox secrets are present", () => {
  const missing = tamaraAdapter.readiness({ NAVIXA_TAMARA_ENABLED: "true" });
  assert.equal(missing.enabled, false);
  assert.deepEqual(missing.missingSecrets, ["TAMARA_API_URL", "TAMARA_TEST_API_TOKEN", "TAMARA_WEBHOOK_SECRET"]);
  const ready = tamaraAdapter.readiness({ NAVIXA_TAMARA_ENABLED: "true", TAMARA_API_URL: "https://api.tamara.test", TAMARA_TEST_API_TOKEN: "test_token", TAMARA_WEBHOOK_SECRET: "webhook_secret" });
  assert.equal(ready.enabled, true);
  assert.equal(ready.mode, "sandbox");
});

test("Telr remains disabled until an administrator enables it and all sandbox credentials exist", () => {
  const missing = telrAdapter.readiness({ NAVIXA_TELR_ENABLED: "true" });
  assert.equal(missing.enabled, false);
  assert.deepEqual(missing.missingSecrets, ["TELR_STORE_ID", "TELR_TEST_AUTH_KEY", "TELR_WEBHOOK_SECRET"]);
  const ready = telrAdapter.readiness({ NAVIXA_TELR_ENABLED: "true", TELR_STORE_ID: "1234", TELR_TEST_AUTH_KEY: "test_key", TELR_WEBHOOK_SECRET: "webhook_secret" });
  assert.equal(ready.enabled, true);
  assert.equal(ready.mode, "sandbox");
});

test("Telr hosted checkout uses major SAR units and refuses to construct a request while disabled", () => {
  const intent = { id: "intent_123", amount: 1900, currency: "SAR" as const, description: "NAVIXA Plus", callbackUrl: "https://navixasa.com/plus/complete?intent=intent_123", metadata: { navixa_intent: "intent_123" } };
  const disabled = buildTelrHostedPaymentRequest({ intent, environment: {}, authorisedUrl: intent.callbackUrl, declinedUrl: intent.callbackUrl, cancelledUrl: intent.callbackUrl, webhookUrl: "https://navixasa.com/api/billing/webhooks/telr", panels: ["card"] });
  assert.equal(disabled.ok, false);
  const configured = buildTelrHostedPaymentRequest({ intent, environment: { NAVIXA_TELR_ENABLED: "true", TELR_STORE_ID: "1234", TELR_TEST_AUTH_KEY: "test_key", TELR_WEBHOOK_SECRET: "webhook_secret" }, authorisedUrl: intent.callbackUrl, declinedUrl: intent.callbackUrl, cancelledUrl: intent.callbackUrl, webhookUrl: "https://navixasa.com/api/billing/webhooks/telr", panels: ["card", "applepay"] });
  assert.equal(configured.ok, true);
  if (configured.ok) {
    assert.equal(configured.request.order.amount, "19.00");
    assert.equal(configured.request.order.test, "1");
    assert.equal(configured.request.order.cartid, "intent_123");
    assert.equal(configured.request.panels, "card,applepay");
  }
});
