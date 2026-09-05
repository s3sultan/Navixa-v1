import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch config centralizes dates and quotas",()=>{const source=fs.readFileSync("app/launchTrialConfig.ts","utf8");assert.match(source,/LAUNCH_TRIAL_START/);assert.match(source,/LAUNCH_TRIAL_REMINDER_START/);assert.match(source,/LAUNCH_TRIAL_END/);assert.match(source,/DEFAULT_PLAN_USAGE_LIMITS/);});
