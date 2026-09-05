import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch access implementation relies on existing platform primitives",()=>{for(const file of ["app/LaunchTrialNotice.tsx","app/TrialAccessBootstrap.tsx","app/AccessComparison.tsx"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/from\s+["'](?!next\/|react|\.\/|\.\.\/)/);}});
