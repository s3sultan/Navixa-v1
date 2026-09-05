import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("access docs forbid trusting client plan and usage for protected services",()=>{
  const source=fs.readFileSync("app/api/access/README.md","utf8");
  assert.match(source,/Do not use a client-provided plan as proof/);
  assert.match(source,/trusted server-side usage counters/);
});
