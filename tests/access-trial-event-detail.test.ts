import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial state event exposes only active and phase",()=>{const source=fs.readFileSync("app/TrialAccessBootstrap.tsx","utf8");assert.match(source,/detail:\{active:data\.active,phase:data\.phase\}/);});
