import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial-sensitive public APIs are dynamic and no-store",()=>{for(const file of ["app/api/access/trial/route.ts","app/api/access/catalog/route.ts","app/api/access/heavy-policy/route.ts"]){const source=fs.readFileSync(file,"utf8");assert.match(source,/dynamic="force-dynamic"/);assert.match(source,/Cache-Control":"no-store/);}});
