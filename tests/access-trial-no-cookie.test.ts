import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("global launch schedule is not controlled by a user cookie",()=>{for(const file of ["app/launchTrial.ts","app/launchTrialServer.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/cookie/i);}});
