import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("comparison table scrolls safely on narrow screens",()=>{const source=fs.readFileSync("app/AccessComparison.tsx","utf8");assert.match(source,/overflowX:"auto"/);});
