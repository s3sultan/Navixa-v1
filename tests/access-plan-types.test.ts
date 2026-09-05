import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("plan types are limited to free Azm Himma",()=>{const source=fs.readFileSync("app/planAccess.ts","utf8");assert.match(source,/"free" \| "azm" \| "himma"/);});
