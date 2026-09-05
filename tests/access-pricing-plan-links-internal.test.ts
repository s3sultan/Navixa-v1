import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing plan cards use canonical internal compatibility routes",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/plan\.id==="monthly"\?"\/plus":"\/sprint"/);});
