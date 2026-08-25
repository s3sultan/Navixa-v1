import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("weekly site health remains defensive and CSP reporting remains aggregate-only", async () => {
  const [health, csp, admin] = await Promise.all([read("worker/siteHealth.ts"), read("app/api/security/csp-report/route.ts"), read("app/api/admin/site-health/route.ts")]);
  assert.match(health, /https:\/\/navixasa\.com\$\{path\}/);
  assert.doesNotMatch(health, /\/api\/account|password|otp|login attempt/i);
  assert.match(health, /navixa_weekly_site_health/);
  assert.match(csp, /recordCspCompatibilityReport/);
  assert.doesNotMatch(csp, /document-uri/);
  assert.match(admin, /verifyAdminSessionToken/);
  assert.match(admin, /Cache-Control": "no-store/);
});
