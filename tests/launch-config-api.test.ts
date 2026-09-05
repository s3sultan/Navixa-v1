import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("launch config endpoint uses canonical config and no-store",()=>{
  const source=fs.readFileSync("app/api/access/launch-config/route.ts","utf8");
  assert.match(source,/LAUNCH_TRIAL_CONFIG/);
  assert.match(source,/Cache-Control":"no-store/);
});
