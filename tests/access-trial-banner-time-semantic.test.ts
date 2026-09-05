import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder uses semantic time element for cutoff",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/<time dateTime=\{LAUNCH_TRIAL_END\}>/);});
