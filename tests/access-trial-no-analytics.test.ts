import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder adds no analytics dependency",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.doesNotMatch(source,/analytics|gtag|pixel|segment/i);});
