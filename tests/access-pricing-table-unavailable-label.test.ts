import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("comparison uses a neutral unavailable mark",()=>{const source=fs.readFileSync("app/AccessComparison.tsx","utf8");assert.match(source,/"—"/);});
