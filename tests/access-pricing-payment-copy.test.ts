import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing keeps safe payment disclosure",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/لا تخزن NAVIXA بيانات البطاقة/);assert.match(source,/مزود الدفع المعتمد/);});
