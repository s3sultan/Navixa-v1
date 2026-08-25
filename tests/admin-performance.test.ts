import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
test("admin performance stays aggregated and private", async () => {
  const route = await readFile(new URL("app/api/admin/performance/route.ts", root), "utf8");
  assert.match(route, /verifyAdminSessionToken/);
  assert.match(route, /navixa_performance_windows/);
  assert.match(route, /Cache-Control": "no-store/);
  assert.doesNotMatch(route, /navixa_performance_samples/);
});
