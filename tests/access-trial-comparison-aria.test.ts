import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access comparison table has an accessible label",()=>{const source=fs.readFileSync("app/AccessComparison.tsx","utf8");assert.match(source,/aria-label="مقارنة باقات NAVIXA"/);});
