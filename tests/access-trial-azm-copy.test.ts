import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing describes Azm only as monitoring name-call plus free",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/عَزْم للمراقبة ونداء الاسم مع المزايا المجانية/);assert.match(source,/مراقبة الشاشة \+ نداء الاسم \+ المزايا المجانية/);});
