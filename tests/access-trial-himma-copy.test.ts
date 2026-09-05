import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing describes Himma as full NAVIXA access",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/هِمّة تفتح كامل NAVIXA/);assert.match(source,/كامل مميزات NAVIXA والمشاريع المشمولة/);});
