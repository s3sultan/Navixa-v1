import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial notice does not interpolate personal data",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.doesNotMatch(source,/email|phone|userName|firstName|lastName/);});
