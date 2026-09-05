import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("reminder ignores late network responses after unmount",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/let live=true/);assert.match(source,/if\(live&&data\)setStatus/);assert.match(source,/live=false/);});
