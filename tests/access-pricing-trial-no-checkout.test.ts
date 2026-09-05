import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial explanation has no checkout action",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");const marker=source.indexOf("فترة الإطلاق التجريبية");assert.ok(marker>=0);assert.doesNotMatch(source.slice(marker,marker+400),/checkout|شراء|ادفع/);});
