import assert from "node:assert/strict";
import test from "node:test";
import { canApproveManualReview, isSallaManualOrderId, normalizeSallaManualOrderId, SALLA_MANUAL_AMOUNT_MINOR, SALLA_MANUAL_CURRENCY, SALLA_MANUAL_PRODUCT_ID } from "../app/billing/sallaManualReview.ts";
import { readFile } from "node:fs/promises";

test("قبول المراجعة اليدوية محصور في طلب معلق ورقم سلة بصيغة آمنة", () => {
  assert.equal(canApproveManualReview("pending"), true);
  assert.equal(canApproveManualReview("processing"), false);
  assert.equal(canApproveManualReview("approved"), false);
  assert.equal(isSallaManualOrderId("A7rJG4yO9YgKa20KB2xMPjlzZk6QX2n0"), true);
  assert.equal(isSallaManualOrderId("order?paid=true"), false);
  assert.equal(normalizeSallaManualOrderId("  A7rJG4yO9YgKa20KB2xMPjlzZk6QX2n0 "), "A7rJG4yO9YgKa20KB2xMPjlzZk6QX2n0");
});

test("تفعيل المراجعة اليدوية لا يقبل دليل العميل ويتطلب سجلًا ذريًا واستحقاقًا واحدًا", async () => {
  const route = await readFile(new URL("../app/api/admin/salla-manual-reviews/route.ts", import.meta.url), "utf8");
  const requestRoute = await readFile(new URL("../app/api/billing/salla/manual-review/route.ts", import.meta.url), "utf8");
  assert.match(requestRoute, /تم إيقاف مسار سلة مؤقتًا/);
  assert.match(requestRoute, /status: 503/);
  assert.doesNotMatch(requestRoute, /SALLA_PRODUCT_URL|window\.location|checkoutUrl|resolveUserSession/);
  assert.doesNotMatch(requestRoute, /receipt|paymentStatus|customerEmail|sallaOrderId/);
  assert.match(route, /isTrustedSameOriginRequest/);
  assert.match(route, /UPDATE navixa_salla_manual_reviews SET status='processing'/);
  assert.match(route, /INSERT INTO navixa_salla_entitlements/);
  assert.match(route, /INSERT INTO navixa_salla_orders/);
  assert.match(route, /batch\(/);
  assert.match(route, /SALLA_MANUAL_PRODUCT_ID/);
  assert.match(route, /SALLA_MANUAL_AMOUNT_MINOR/);
  assert.match(route, /SALLA_MANUAL_CURRENCY/);
  assert.equal(SALLA_MANUAL_PRODUCT_ID, "41013139");
  assert.equal(SALLA_MANUAL_AMOUNT_MINOR, 1900);
  assert.equal(SALLA_MANUAL_CURRENCY, "SAR");
  assert.match(route, /رقم طلب سلة استُخدم مسبقًا/);
});
