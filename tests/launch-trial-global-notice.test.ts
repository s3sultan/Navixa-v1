import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("subscription reminder is global rather than homepage-only",()=>{const layout=fs.readFileSync("app/layout.tsx","utf8");assert.match(layout,/<LaunchTrialNotice \/>/);});
