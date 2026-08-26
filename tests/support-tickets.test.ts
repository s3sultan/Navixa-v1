import assert from "node:assert/strict";
import test from "node:test";
import { SUPPORT_CLOSED_RETENTION_DAYS, containsSensitiveSupportData, parseSupportStatus, parseSupportTicketInput } from "../worker/supportTickets.ts";

test("support ticket input allows bounded product context and strips neither user identity nor secrets into the payload", () => {
  const result = parseSupportTicketInput({ product: "fitness", category: "technical", subject: "الصفحة لا تفتح", description: "تظهر لي رسالة خطأ عند فتح صفحة التمارين." });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value, { product: "fitness", category: "technical", subject: "الصفحة لا تفتح", description: "تظهر لي رسالة خطأ عند فتح صفحة التمارين." });
});

test("support ticket validation rejects credentials and payment-like secrets", () => {
  assert.equal(containsSensitiveSupportData("api key: sk_live_abcdefghijklmnop"), true);
  assert.equal(containsSensitiveSupportData("بطاقتي 4111 1111 1111 1111"), true);
  const result = parseSupportTicketInput({ product: "main", category: "account", subject: "مشكلة الحساب", description: "رمز التحقق: 123456" });
  assert.equal(result.ok, false);
});

test("support status and retention are limited to the approved policy", () => {
  assert.equal(parseSupportStatus("resolved"), "resolved");
  assert.equal(parseSupportStatus("delete_everything"), null);
  assert.equal(SUPPORT_CLOSED_RETENTION_DAYS, 90);
});
