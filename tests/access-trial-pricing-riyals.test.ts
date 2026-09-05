import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing converts canonical halalas to displayed riyals",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/amount\/100/);assert.match(source,/toLocaleString\("ar-SA"/);});
