import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("trial state is globally published and self-expires",()=>{
  const source=fs.readFileSync("app/TrialAccessBootstrap.tsx","utf8");
  const layout=fs.readFileSync("app/layout.tsx","utf8");
  assert.match(source,/dataset\.navixaTrial/);
  assert.match(source,/setInterval\(sync,30000\)/);
  assert.match(source,/pageshow/);
  assert.match(layout,/TrialAccessBootstrap/);
});
