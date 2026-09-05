import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing explains post-trial free fallback",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/تعود الحسابات غير المشتركة إلى المزايا المجانية/);});
