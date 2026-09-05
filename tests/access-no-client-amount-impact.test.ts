import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access update does not add client-controlled payment amounts",()=>{for(const file of ["app/api/access/entitlement/route.ts","app/api/access/heavy-policy/route.ts","app/api/access/trial/route.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/amount|price|halala/i);}});
