import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { emergencyEntitlementKey, normalizeEmergencyEmail } from "../worker/emergencyEntitlements.ts";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("emergency entitlement keys normalize email and do not expose raw identity", async () => {
  assert.equal(normalizeEmergencyEmail("  User@Example.COM "), "user@example.com");
  const a = await emergencyEntitlementKey("User@Example.com", "test-secret-1234567890");
  const b = await emergencyEntitlementKey(" user@example.COM ", "test-secret-1234567890");
  const c = await emergencyEntitlementKey("other@example.com", "test-secret-1234567890");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.doesNotMatch(a, /user|example/i);
});

test("snapshot implementation keeps Plan B dataset minimal and paid-Plus only", async () => {
  const source = await read("worker/emergencyEntitlements.ts");
  assert.match(source, /status='active'/);
  assert.match(source, /subscription_ends_at>\?/);
  assert.match(source, /entitlementKey/);
  assert.match(source, /activeUntil/);
  assert.doesNotMatch(source, /display_name|telegram_user|payment|card|otp|session_token/i);
  assert.doesNotMatch(source, /SELECT \*/i);
});
