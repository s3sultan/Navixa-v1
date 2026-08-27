import assert from "node:assert/strict";
import test from "node:test";
import { safeSallaCheckoutIntent, toSallaReturnStatus } from "../app/billing/sallaEntitlementStatus.ts";

test("حالة عودة سلة لا تقبل نية غير آمنة", () => {
  assert.equal(safeSallaCheckoutIntent("salla_intent_founder_2026_001"), "salla_intent_founder_2026_001");
  assert.equal(safeSallaCheckoutIntent("order-1?status=paid"), null);
  assert.equal(safeSallaCheckoutIntent(null), null);
});

test("لا تعرض عودة سلة نجاحًا إلا لاستحقاق داخلي نشط وغير منتهٍ", () => {
  const future = "2030-01-01T00:00:00.000Z";
  assert.deepEqual(toSallaReturnStatus(null, Date.parse("2029-01-01T00:00:00.000Z")), { state: "pending" });
  assert.deepEqual(toSallaReturnStatus({ status: "pending", endsAt: future }, Date.parse("2029-01-01T00:00:00.000Z")), { state: "not_activated" });
  assert.deepEqual(toSallaReturnStatus({ status: "active", endsAt: future }, Date.parse("2029-01-01T00:00:00.000Z")), { state: "active", endsAt: future });
  assert.deepEqual(toSallaReturnStatus({ status: "active", endsAt: future }, Date.parse("2031-01-01T00:00:00.000Z")), { state: "not_activated" });
});
