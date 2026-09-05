import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing continues to prefer server catalog over fallback",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/if\(data\?\.plans\?\.length===2\)setPlans\(data\.plans\)/);});
