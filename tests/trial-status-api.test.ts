import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("trial status uses server clock and no-store",()=>{
  const source=fs.readFileSync("app/api/access/trial/route.ts","utf8");
  assert.match(source,/const now=new Date\(\)/);
  assert.match(source,/launchTrialPhase\(now\)/);
  assert.match(source,/remainingMs/);
  assert.match(source,/Cache-Control":"no-store/);
});
