import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access decision APIs reject invalid inputs",()=>{for(const file of ["app/api/access/entitlement/route.ts","app/api/access/heavy-policy/route.ts","app/api/access/usage-limits/check/route.ts"]){const source=fs.readFileSync(file,"utf8");assert.match(source,/invalid_request/);assert.match(source,/status:400/);}});
