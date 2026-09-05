import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access catalog endpoint is dynamic and no-store",()=>{const source=fs.readFileSync("app/api/access/catalog/route.ts","utf8");assert.match(source,/force-dynamic/);assert.match(source,/no-store/);});
