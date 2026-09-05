import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing shows exact trial cutoff date and time",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/السبت 12 سبتمبر 2026 الساعة 4:00 مساءً بتوقيت السعودية/);});
