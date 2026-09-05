import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("reminder emphasizes Himma before Azm",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.ok(source.indexOf("LAUNCH_TRIAL_COPY.himma")<source.indexOf("LAUNCH_TRIAL_COPY.azm"));});
