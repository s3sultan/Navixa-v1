import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing trial disclosure names Saturday cutoff",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/السبت 12 سبتمبر 2026/);});
