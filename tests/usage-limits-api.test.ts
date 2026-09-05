import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("usage limits API is no-store and canonical",()=>{
  const source=fs.readFileSync("app/api/access/usage-limits/route.ts","utf8");
  assert.match(source,/DEFAULT_PLAN_USAGE_LIMITS/);
  assert.match(source,/Cache-Control":"no-store/);
});
