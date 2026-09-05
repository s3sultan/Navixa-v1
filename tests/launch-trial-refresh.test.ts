import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial state and reminder refresh without page reload",()=>{for(const file of ["app/TrialAccessBootstrap.tsx","app/LaunchTrialNotice.tsx"]){const source=fs.readFileSync(file,"utf8");assert.match(source,/setInterval\(sync,30000\)/);assert.match(source,/pageshow/);}});
