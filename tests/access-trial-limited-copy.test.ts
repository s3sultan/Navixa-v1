import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("public pricing never describes launch trial as unlimited",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/استخدام مجاني ومحدود لكامل NAVIXA/);assert.doesNotMatch(source,/غير محدود|بلا حدود/);});
