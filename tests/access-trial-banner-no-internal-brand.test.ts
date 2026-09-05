import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("reminder copy contains no public Plus or Sprint labels",()=>{const source=fs.readFileSync("app/launchTrialCopy.ts","utf8");assert.doesNotMatch(source,/Plus|Sprint/);});
