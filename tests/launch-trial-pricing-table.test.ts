import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing comparison includes trial as its own column",()=>{const source=fs.readFileSync("app/AccessComparison.tsx","utf8");assert.match(source,/<th>مجاني<\/th><th>التجربة<\/th><th>عَزْم<\/th><th>هِمّة<\/th>/);});
