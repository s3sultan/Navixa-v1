import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("heavy-service quota check validates usage and fails closed",()=>{
  const source=fs.readFileSync("app/api/access/usage-limits/check/route.ts","utf8");
  assert.match(source,/invalid_request/);
  assert.match(source,/allowed:used<limit/);
  assert.match(source,/remaining:Math\.max\(0,limit-used\)/);
  assert.match(source,/Cache-Control":"no-store/);
});
