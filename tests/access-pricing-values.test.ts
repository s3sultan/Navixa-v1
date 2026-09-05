import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch access work preserves official fallback prices",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/name:"هِمّة"[^\n]*amount:2900/);assert.match(source,/name:"عَزْم"[^\n]*amount:1100/);});
