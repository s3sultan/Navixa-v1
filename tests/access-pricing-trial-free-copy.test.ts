import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch trial is explicitly described as free",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/استخدام مجاني ومحدود لكامل NAVIXA/);});
