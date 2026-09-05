import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("entitlement endpoint validates plan and capability server-side",()=>{
  const source=fs.readFileSync("app/api/access/entitlement/route.ts","utf8");
  assert.match(source,/hasPlanCapability/);
  assert.match(source,/invalid_request/);
  assert.match(source,/Cache-Control":"no-store/);
  assert.match(source,/"screen-monitoring","name-call","summarization"/);
});
