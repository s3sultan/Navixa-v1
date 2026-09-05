import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing remains RTL Arabic",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/<main dir="rtl"/);});
