import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access model adds no third-party runtime dependency",()=>{for(const file of ["app/launchTrial.ts","app/planAccess.ts","app/planAccessPolicy.ts","app/accessUsagePolicy.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/from\s+["'](?!\.\/|\.\.\/)/);}});
