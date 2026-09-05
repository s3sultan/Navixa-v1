import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("Wednesday reminder stays visible instead of being permanently dismissible",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.doesNotMatch(source,/dismiss|close|localStorage/);});
