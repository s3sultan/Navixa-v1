import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const route=await readFile(new URL("../app/api/admin/push-lab/route.ts",import.meta.url),"utf8");
const lab=await readFile(new URL("../app/admin/settings/AdminPushLab.tsx",import.meta.url),"utf8");
const helper=await readFile(new URL("../worker/generalPush.ts",import.meta.url),"utf8");

test("admin Push lab requires admin session and same-origin requests",()=>{
  assert.match(route,/isTrustedSameOriginRequest/);
  assert.match(route,/verifyAdminSessionToken/);
  assert.match(route,/ADMIN_SESSION_COOKIE/);
});

test("Push lab supports feature events and configurable preview",()=>{
  assert.match(lab,/name_heard/);
  assert.match(lab,/screen_watch/);
  assert.match(lab,/type=\"color\"/);
  assert.match(lab,/type=\"range\"/);
  assert.match(lab,/requireInteraction/);
  assert.match(helper,/sendFeaturePush/);
  assert.match(helper,/webpush\.sendNotification/);
});
