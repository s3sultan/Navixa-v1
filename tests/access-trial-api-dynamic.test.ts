import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial status endpoint cannot be statically frozen",()=>{const source=fs.readFileSync("app/api/access/trial/route.ts","utf8");assert.match(source,/export const dynamic="force-dynamic"/);});
