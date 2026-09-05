import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial bootstrap publishes active state and phase separately",()=>{const source=fs.readFileSync("app/TrialAccessBootstrap.tsx","utf8");assert.match(source,/dataset\.navixaTrial=/);assert.match(source,/dataset\.navixaTrialPhase=/);});
