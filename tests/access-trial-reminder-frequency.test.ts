import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("onsite reminder refreshes at a modest interval",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/setInterval\(sync,30000\)/);assert.doesNotMatch(source,/setInterval\(sync,(?:[0-9]{1,4})\)/);});
