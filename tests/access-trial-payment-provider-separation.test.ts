import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access policy is independent of payment provider implementation",()=>{for(const file of ["app/planAccess.ts","app/planAccessPolicy.ts","app/accessUsagePolicy.ts","app/launchTrial.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/moyasar|stripe|payment|checkout/i);}});
