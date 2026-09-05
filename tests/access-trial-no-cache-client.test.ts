import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial clients bypass browser cache",()=>{for(const file of ["app/LaunchTrialNotice.tsx","app/TrialAccessBootstrap.tsx"]){const source=fs.readFileSync(file,"utf8");assert.match(source,/cache:"no-store"/);}});
