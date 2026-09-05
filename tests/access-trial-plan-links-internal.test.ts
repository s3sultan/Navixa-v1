import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder plan links stay internal",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/href="\/plus"/);assert.match(source,/href="\/sprint"/);assert.doesNotMatch(source,/href="https?:/);});
