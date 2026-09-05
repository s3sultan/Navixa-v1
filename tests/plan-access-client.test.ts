import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("client entitlement helper fails closed",()=>{
  const source=fs.readFileSync("app/planAccessClient.ts","utf8");
  assert.match(source,/cache:"no-store"/);
  assert.match(source,/if\(!response\.ok\)return false/);
  assert.match(source,/allowed===true/);
});
