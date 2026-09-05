import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder uses centralized copy",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/LAUNCH_TRIAL_COPY\.title/);assert.match(source,/LAUNCH_TRIAL_COPY\.body/);assert.match(source,/LAUNCH_TRIAL_COPY\.himma/);assert.match(source,/LAUNCH_TRIAL_COPY\.azm/);});
