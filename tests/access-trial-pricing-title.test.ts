import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing page retains clear official title",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/NAVIXA SA · قائمة الأسعار الرسمية/);assert.match(source,/id="pricing-title"/);});
