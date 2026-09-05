import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing tells users what happens after launch trial",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/بعد انتهائها تعود الحسابات غير المشتركة إلى المزايا المجانية/);assert.match(source,/السبت 12 سبتمبر 2026 الساعة 4:00 مساءً بتوقيت السعودية/);});
