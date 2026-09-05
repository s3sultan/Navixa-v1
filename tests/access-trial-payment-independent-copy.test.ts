import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial public copy does not promise payment-provider readiness",()=>{for(const file of ["app/LaunchTrialNotice.tsx","app/pricing/page.tsx"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/ميسر|Moyasar/);}});
