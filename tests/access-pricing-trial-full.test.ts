import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial copy says full NAVIXA scope",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/محدود لكامل NAVIXA/);});
