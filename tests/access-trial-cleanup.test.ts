import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial polling cleans up timers and pageshow listeners",()=>{for(const file of ["app/LaunchTrialNotice.tsx","app/TrialAccessBootstrap.tsx"]){const source=fs.readFileSync(file,"utf8");assert.match(source,/clearInterval\(id\)/);assert.match(source,/removeEventListener\("pageshow",sync\)/);}});
