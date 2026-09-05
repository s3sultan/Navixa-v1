import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing still loads canonical billing catalog rather than hardcoding live price only",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/fetch\("\/api\/billing\/catalog",\{cache:"no-store"\}\)/);});
