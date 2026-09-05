import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing preserves conditional discount disclosure",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/قد يطبق كود خصم صالح عند توفره/);});
