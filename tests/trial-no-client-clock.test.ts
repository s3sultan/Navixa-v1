import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial UI does not decide access from client clock",()=>{for(const file of ["app/LaunchTrialNotice.tsx","app/TrialAccessBootstrap.tsx"]){const source=fs.readFileSync(file,"utf8");assert.match(source,/\/api\/access\/trial/);assert.doesNotMatch(source,/launchTrialPhase\(new Date\(\)\)/);}});
