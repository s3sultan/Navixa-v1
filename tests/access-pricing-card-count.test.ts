import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing keeps exactly two paid plan fallbacks",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/data\?\.plans\?\.length===2/);assert.match(source,/id:"monthly"/);assert.match(source,/id:"sprint"/);});
