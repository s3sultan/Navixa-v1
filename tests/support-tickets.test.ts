import assert from "node:assert/strict";
import test from "node:test";
import { SUPPORT_CLOSED_RETENTION_DAYS, containsSensitiveSupportData, parseSupportStatus, parseSupportTicketInput } from "../worker/supportTickets.ts";
import { GET as listUserTickets, POST as createUserTicket } from "../app/api/support/tickets/route.ts";
import { GET as listAdminTickets } from "../app/api/admin/support/tickets/route.ts";

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

test("support endpoints deny anonymous and cross-origin access without creating tickets", async () => {
  const prior = (globalThis as typeof globalThis & { DB?: unknown }).DB;
  (globalThis as typeof globalThis & { DB?: { prepare: () => unknown } }).DB = { prepare: () => { throw new Error("unauthorized paths must not query tickets"); } };
  try {
    const anonymous = await listUserTickets(new Request("https://navixa.example/api/support/tickets"));
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.headers.get("cache-control"), "no-store");
    const crossOrigin = await createUserTicket(new Request("https://navixa.example/api/support/tickets", { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({}) }));
    assert.equal(crossOrigin.status, 403);
    const admin = await listAdminTickets(new Request("https://navixa.example/api/admin/support/tickets"));
    assert.equal(admin.status, 401);
    assert.equal(admin.headers.get("cache-control"), "no-store");
  } finally {
    if (prior === undefined) delete (globalThis as typeof globalThis & { DB?: unknown }).DB;
    else (globalThis as typeof globalThis & { DB?: unknown }).DB = prior;
  }
});
