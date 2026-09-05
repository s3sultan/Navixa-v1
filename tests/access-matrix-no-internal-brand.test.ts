import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("public comparison matrix contains no Plus or Sprint labels",()=>{const source=fs.readFileSync("app/accessFeatureMatrix.ts","utf8");assert.doesNotMatch(source,/Plus|Sprint/);});
