import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("paid plan cards state their approved scopes",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/كامل مميزات NAVIXA والمشاريع المشمولة/);assert.match(source,/مراقبة الشاشة \+ نداء الاسم \+ المزايا المجانية/);});
