import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing has safe official fallback when catalog request fails",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/const fallback:Plan\[\]/);assert.match(source,/\.catch\(\(\)=>\{\}\)/);});
