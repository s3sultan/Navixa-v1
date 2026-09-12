import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const route=await readFile(new URL("../app/api/admin/push-lab/route.ts",import.meta.url),"utf8");
const lab=await readFile(new URL("../app/admin/settings/AdminPushLab.tsx",import.meta.url),"utf8");
const helper=await readFile(new URL("../worker/generalPush.ts",import.meta.url),"utf8");
const serviceWorker=await readFile(new URL("../public/navixa-push-sw.js",import.meta.url),"utf8");

test("admin Push lab requires admin session and same-origin requests",()=>{
  assert.match(route,/isTrustedSameOriginRequest/);
  assert.match(route,/verifyAdminSessionToken/);
  assert.match(route,/ADMIN_SESSION_COOKIE/);
});

test("Push lab supports feature events and configurable preview",()=>{
  assert.match(lab,/name_heard/);
  assert.match(lab,/screen_watch/);
  assert.match(lab,/type=\"color\"/);
  assert.match(lab,/requireInteraction/);
  assert.match(helper,/sendFeaturePush/);
  assert.match(helper,/webpush\.sendNotification/);
});

test("Watch-ready Push uses NAVIXA smart priority profiles",()=>{
  assert.match(helper,/FeaturePushPriority/);
  assert.match(helper,/name_heard:\"important\"/);
  assert.match(helper,/screen_watch:\"important\"/);
  assert.match(helper,/security:\"critical\"/);
  assert.match(helper,/resolveFeaturePushPriority/);
  assert.match(route,/allowedPriorities/);
  assert.match(lab,/تلقائية حسب النوع/);
});

test("quick notification actions are validated and degrade safely",()=>{
  assert.match(route,/readActions/);
  assert.match(route,/safeRelativeUrl/);
  assert.match(helper,/sanitizeActions/);
  assert.match(helper,/actions\.slice\(0,2\)/);
  assert.match(serviceWorker,/Notification\.maxActions/);
  assert.match(serviceWorker,/event\.action/);
  assert.match(serviceWorker,/selectedAction===\"dismiss\"/);
  assert.match(serviceWorker,/delete fallbackOptions\.actions/);
  assert.match(lab,/فتح NAVIXA/);
  assert.match(lab,/action:\"dismiss\",title:\"تم\"/);
});
