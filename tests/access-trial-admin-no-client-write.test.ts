import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("public access APIs expose no unauthenticated config write method",()=>{for(const file of ["app/api/access/trial/route.ts","app/api/access/catalog/route.ts","app/api/access/launch-config/route.ts","app/api/access/usage-limits/route.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/export async function (POST|PUT|PATCH|DELETE)/);}});
