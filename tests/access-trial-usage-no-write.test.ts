import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("quota helper endpoints are read-only",()=>{for(const file of ["app/api/access/usage-limits/route.ts","app/api/access/usage-limits/check/route.ts","app/api/access/heavy-policy/route.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/export async function (POST|PUT|PATCH|DELETE)/);}});
