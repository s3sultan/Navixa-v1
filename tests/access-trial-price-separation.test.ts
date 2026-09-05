import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access model does not duplicate billing price authority",()=>{for(const file of ["app/accessModel.ts","app/planAccess.ts","app/planAccessPolicy.ts","app/accessUsagePolicy.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/2900|1100|29\s*ريال|11\s*ريال/);}});
