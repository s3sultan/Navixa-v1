import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch trial is explained separately rather than sold as a paid plan",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/<strong>فترة الإطلاق التجريبية<\/strong>/);assert.doesNotMatch(source,/id:"trial"/);});
