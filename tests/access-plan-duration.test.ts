import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing preserves Himma 30-day and Azm 5-day durations",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/name:"هِمّة",days:30/);assert.match(source,/name:"عَزْم",days:5/);});
