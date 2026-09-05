import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial expiry is not controlled by user-editable browser storage",()=>{for(const file of ["app/launchTrial.ts","app/TrialAccessBootstrap.tsx","app/LaunchTrialNotice.tsx"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/localStorage|sessionStorage/);}});
