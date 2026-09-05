import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial UI fails quietly if status endpoint is unavailable",()=>{for(const file of ["app/TrialAccessBootstrap.tsx","app/LaunchTrialNotice.tsx"]){const source=fs.readFileSync(file,"utf8");assert.match(source,/\.catch\(\(\)=>\{\}\)/);}});
