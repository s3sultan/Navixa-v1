import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing says final amount is shown before payment",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/يعرض السعر النهائي قبل الدفع/);});
