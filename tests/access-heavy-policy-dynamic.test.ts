import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("heavy-service policy endpoint is dynamic and no-store",()=>{const source=fs.readFileSync("app/api/access/heavy-policy/route.ts","utf8");assert.match(source,/force-dynamic/);assert.match(source,/no-store/);});
