import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reporter = fs.readFileSync("app/VisitorReporter.tsx", "utf8");
const endpoint = fs.readFileSync("app/api/visitor/event/route.ts", "utf8");
const admin = fs.readFileSync("app/api/admin/usage-analytics/route.ts", "utf8");
const overview = fs.readFileSync("app/admin/AdminOverview.tsx", "utf8");

test("visitor reporting stores only path and timestamp server-side", () => {
  assert.match(endpoint, /navixa_public_pageviews/);
  assert.doesNotMatch(endpoint, /ip_address|user_agent|email|cookie/i);
  assert.match(endpoint, /isTrustedSameOriginRequest/);
});

test("admin launch overview exposes Riyadh-day traffic", () => {
  assert.match(admin, /Asia\/Riyadh/);
  assert.match(admin, /todayEntrances/);
  assert.match(admin, /todayPageviews/);
  assert.match(overview, /زيارات اليوم/);
  assert.match(overview, /الصفحات الأكثر زيارة/);
});

test("admin and api paths are never reported as public visits", () => {
  assert.match(reporter, /"\/admin", "\/api"/);
  assert.match(endpoint, /!value\.startsWith\("\/admin"\)/);
});
