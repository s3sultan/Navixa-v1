import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing renders approved access comparison",()=>{const pricing=fs.readFileSync("app/pricing/page.tsx","utf8");const comparison=fs.readFileSync("app/AccessComparison.tsx","utf8");assert.match(pricing,/AccessComparison/);assert.match(comparison,/مجاني/);assert.match(comparison,/التجربة/);assert.match(comparison,/عَزْم/);assert.match(comparison,/هِمّة/);});
