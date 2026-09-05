import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch pricing does not introduce an annual plan",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.doesNotMatch(source,/سنوي|yearly|annual/i);});
