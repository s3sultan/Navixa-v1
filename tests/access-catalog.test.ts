import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("access catalog exposes only approved Azm paid capabilities",()=>{
  const source=fs.readFileSync("app/api/access/catalog/route.ts","utf8");
  assert.match(source,/NAVIXA_ACCESS_MODEL/);
  assert.match(source,/capabilities:\["screen-monitoring","name-call"\]/);
  assert.doesNotMatch(source,/capabilities:\[[^\]]*summarization/);
});
