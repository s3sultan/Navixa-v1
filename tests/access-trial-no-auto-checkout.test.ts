import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder never triggers checkout automatically",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.doesNotMatch(source,/checkout|payment|purchase/i);});
