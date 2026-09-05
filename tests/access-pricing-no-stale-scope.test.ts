import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("new pricing source contains no stale Azm project access claims",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.doesNotMatch(source,/عَزْم[^\n]*(Kids|Fitness|English Learning)/);});
