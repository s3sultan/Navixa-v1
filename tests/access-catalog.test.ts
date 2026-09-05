import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("access catalog exposes only approved Azm paid capabilities",()=>{
  const source=fs.readFileSync("app/api/access/catalog/route.ts","utf8");
  assert.match(source,/capabilities:\["screen-monitoring","name-call"\]/);
  assert.match(source,/scope:"full-limited"/);
  assert.match(source,/himma:\{scope:"full"\}/);
  assert.doesNotMatch(source,/azm[^\n]*summarization/);
});
