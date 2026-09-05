import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("comparison labels limited trial access in Arabic",()=>{const source=fs.readFileSync("app/AccessComparison.tsx","utf8");assert.match(source,/"محدود"/);});
