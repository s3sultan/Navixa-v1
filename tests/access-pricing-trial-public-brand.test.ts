import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing calls the launch access period a trial",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/فترة الإطلاق التجريبية/);});
