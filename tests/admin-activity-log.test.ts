import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { sanitizeAdminMetadata } from "../worker/adminActivity.ts";

const root = new URL("../", import.meta.url);

test("admin audit metadata redacts credentials and session material", () => {
  const safe = sanitizeAdminMetadata({
    changed: ["game_ad_enabled"],
    token: "secret-token",
    password: "secret-password",
    nested: { otp: "123456", feature: "ok", apiKey: "hidden" },
  });
  assert.deepEqual(safe?.changed, ["game_ad_enabled"]);
  assert.equal(safe?.token, "[redacted]");
  assert.equal(safe?.password, "[redacted]");
  assert.deepEqual(safe?.nested, { otp: "[redacted]", feature: "ok", apiKey: "[redacted]" });
});

test("admin activity has a durable indexed D1 schema", () => {
  const migration = fs.readFileSync(new URL("migrations/0055_admin_activity_log.sql", root), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS navixa_admin_activity/);
  assert.match(migration, /admin_email TEXT NOT NULL/);
  assert.match(migration, /outcome IN \('success','failure'\)/);
  assert.match(migration, /idx_navixa_admin_activity_created_at/);
  assert.match(migration, /idx_navixa_admin_activity_admin_email/);
});

test("activity API and runtime controls enforce explicit admin permissions", () => {
  const activity = fs.readFileSync(new URL("app/api/admin/activity/route.ts", root), "utf8");
  const runtime = fs.readFileSync(new URL("app/api/admin/runtime-features/route.ts", root), "utf8");
  assert.match(activity, /requireAdminPermission\(request, "activity\.read"\)/);
  assert.match(activity, /private, no-store/);
  assert.match(runtime, /requireAdminPermission\(request, "runtime\.manage"\)/);
  assert.match(runtime, /runtime_features\.update/);
  assert.match(runtime, /writeAdminActivity/);
});

test("sensitive admin surfaces use explicit permissions and unified activity logging", () => {
  const access = fs.readFileSync(new URL("worker/adminAccess.ts", root), "utf8");
  const billing = fs.readFileSync(new URL("app/api/admin/billing-settings/route.ts", root), "utf8");
  const discounts = fs.readFileSync(new URL("app/api/admin/discount-codes/route.ts", root), "utf8");
  const quote = fs.readFileSync(new URL("app/api/admin/custom-payment-quote/route.ts", root), "utf8");
  const emergency = fs.readFileSync(new URL("app/api/admin/emergency-mode/route.ts", root), "utf8");
  const email = fs.readFileSync(new URL("app/api/admin/email-test/route.ts", root), "utf8");

  assert.match(access, /billing\.manage/);
  assert.match(access, /emergency\.manage/);
  assert.match(access, /communications\.test/);

  for (const source of [billing, discounts, quote]) {
    assert.match(source, /requireAdminPermission\(request,\s*"billing\.manage"\)/);
    assert.match(source, /writeAdminActivity/);
    assert.doesNotMatch(source, /verifyAdminSessionToken/);
  }
  assert.match(emergency, /requireAdminPermission\(request,\s*"emergency\.manage"\)/);
  assert.match(emergency, /emergency_mode\.update/);
  assert.match(emergency, /writeAdminActivity/);
  assert.doesNotMatch(emergency, /verifyAdminSessionToken/);

  assert.match(email, /requireAdminPermission\(request,\s*"communications\.test"\)/);
  assert.match(email, /email_test\.send/);
  assert.match(email, /writeAdminActivity/);
  assert.doesNotMatch(email, /verifyAdminSessionToken/);
});

test("admin dashboard uses the server-backed access and activity panels", () => {
  const page = fs.readFileSync(new URL("app/admin/page.tsx", root), "utf8");
  const panel = fs.readFileSync(new URL("app/admin/AdminAccessAuditPanel.tsx", root), "utf8");
  assert.match(page, /AdminAccessAuditPanel mode="permissions"/);
  assert.match(page, /AdminAccessAuditPanel mode="activity"/);
  assert.match(page, /سجل النشاط والاستخدام/);
  assert.match(panel, /\/api\/admin\/activity\?limit=40/);
  assert.match(panel, /OTP لا تُحفظ/);
});
