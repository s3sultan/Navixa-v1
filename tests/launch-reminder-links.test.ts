import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder sends users to canonical plan routes",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/href="\/plus"/);assert.match(source,/href="\/sprint"/);});
