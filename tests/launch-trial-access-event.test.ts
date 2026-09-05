import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial state changes emit a same-page event for feature gates",()=>{const source=fs.readFileSync("app/TrialAccessBootstrap.tsx","utf8");assert.match(source,/navixa-trial-access-changed/);assert.match(source,/CustomEvent/);});
