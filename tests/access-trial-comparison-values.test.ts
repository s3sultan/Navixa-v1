import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access comparison distinguishes included limited and unavailable",()=>{const source=fs.readFileSync("app/AccessComparison.tsx","utf8");assert.match(source,/v===true\?"✓":v==="limited"\?"محدود":"—"/);});
