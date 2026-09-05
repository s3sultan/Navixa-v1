import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("new public access modules contain no embedded secret-like values",()=>{for(const file of ["app/launchTrial.ts","app/planAccess.ts","app/planUsageLimits.ts","app/accessModel.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/api[_-]?key|secret|bearer\s+[A-Za-z0-9]/i);}});
