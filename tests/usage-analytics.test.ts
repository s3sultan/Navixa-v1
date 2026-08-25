import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const [event,admin,tracker]=await Promise.all([readFile(new URL("../app/api/usage/event/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/api/admin/usage-analytics/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/UsageTracker.tsx",import.meta.url),"utf8")]);
assert.match(event,/resolveUserSession/);assert.match(event,/paths = new Set/);assert.match(event,/durationSeconds/);assert.match(event,/Cache-Control.*no-store/);assert.match(admin,/verifyAdminSessionToken/);assert.match(admin,/navixa_usage_events/);assert.match(admin,/grid_x/);assert.match(tracker,/sendBeacon/);assert.doesNotMatch(tracker,/innerText|textContent/);console.log("usage analytics privacy contract: ok");
