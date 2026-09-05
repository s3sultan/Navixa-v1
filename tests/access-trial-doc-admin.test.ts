import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access model documentation records admin-configurable direction",()=>{const source=fs.readFileSync("docs/plan-access-model.md","utf8");assert.match(source,/admin-configurable/);assert.match(source,/without code changes/);});
