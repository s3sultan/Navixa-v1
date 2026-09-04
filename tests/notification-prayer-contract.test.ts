import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root=new URL("../",import.meta.url);

test("prayer geolocation must remain allowed by the edge policy",async()=>{
  const worker=await readFile(new URL("worker/index.ts",root),"utf8");
  assert.match(worker,/Permissions-Policy/);
  assert.doesNotMatch(worker,/geolocation=\(\)/,"Prayer location button cannot work while edge policy blocks geolocation");
  assert.match(worker,/geolocation=\(self\)/,"Prayer location must be limited to the NAVIXA top-level origin");
});

test("background prayer delivery must be wired to the scheduled Worker",async()=>{
  const worker=await readFile(new URL("worker/index.ts",root),"utf8");
  assert.match(worker,/deliverDuePrayerAlerts/,"Closed-site prayer alerts need a scheduled server-side delivery job");
});

test("general Push subscriptions must be attributable to a signed-in NAVIXA account",async()=>{
  const route=await readFile(new URL("app/api/push/subscriptions/route.ts",root),"utf8");
  assert.match(route,/resolveUserSession/);
  assert.match(route,/user_id/);
});
