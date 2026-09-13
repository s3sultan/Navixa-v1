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

test("admin dashboard uses the server-backed access and activity panels", () => {
  const page = fs.readFileSync(new URL("app/admin/page.tsx", root), "utf8");
  const panel = fs.readFileSync(new URL("app/admin/AdminAccessAuditPanel.tsx", root), "utf8");
  assert.match(page, /AdminAccessAuditPanel mode="permissions"/);
  assert.match(page, /AdminAccessAuditPanel mode="activity"/);
  assert.match(page, /سجل النشاط والاستخدام/);
  assert.match(panel, /\/api\/admin\/activity\?limit=40/);
  assert.match(panel, /OTP لا تُحفظ/);
});
