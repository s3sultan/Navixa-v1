import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const route=await readFile(new URL("../app/api/push/events/route.ts",import.meta.url),"utf8");
const client=await readFile(new URL("../app/pushClient.ts",import.meta.url),"utf8");
const prefs=await readFile(new URL("../app/alertPrefs.ts",import.meta.url),"utf8");
const reminders=await readFile(new URL("../app/PersonalReminderEngine.tsx",import.meta.url),"utf8");
const center=await readFile(new URL("../app/NotificationCenter.tsx",import.meta.url),"utf8");
const telegramRoute=await readFile(new URL("../app/api/telegram-alert/route.ts",import.meta.url),"utf8");
const telegramPrefs=await readFile(new URL("../app/api/account/telegram/preferences/route.ts",import.meta.url),"utf8");
const pushTest=await readFile(new URL("../app/api/push/test/route.ts",import.meta.url),"utf8");

test("feature push events are same-origin and account-bound",()=>{
  assert.match(route,/isTrustedSameOriginRequest/);
  assert.match(route,/resolveUserSession/);
  assert.match(route,/WHERE user_id=\? AND enabled=1/);
  assert.doesNotMatch(route,/body\.userId|body\.user_id/);
});

test("name and screen events use the unified Push pipeline",()=>{
  assert.match(route,/name_heard/);
  assert.match(route,/screen_watch/);
  assert.match(route,/sendFeaturePush/);
  assert.match(client,/\/api\/push\/events/);
  assert.match(prefs,/sendFeatureAlert\("name"/);
  assert.match(reminders,/sendFeatureAlert\("screen"/);
  assert.match(reminders,/kind:"screen_watch"/);
});

test("screen monitoring shares the same Telegram preferences with a remote cooldown",()=>{
  assert.match(prefs,/screen:"متابعة الشاشة"/);
  assert.match(telegramRoute,/"name","screen"/);
  assert.match(telegramPrefs,/"name","screen"/);
  assert.match(reminders,/SCREEN_REMOTE_COOLDOWN=30_000/);
  assert.match(reminders,/SCREEN_REPEAT_COOLDOWN=60_000/);
});

test("notification center can re-run a real server Push test after activation",()=>{
  assert.match(center,/testBrowserPush/);
  assert.match(center,/اختبار Push الآن/);
  assert.match(center,/sendNavixaPushTest\(subscription\.endpoint\)/);
  assert.match(pushTest,/webpush\.sendNotification/);
  assert.match(pushTest,/NAVIXA · اختبار Push/);
  assert.match(pushTest,/وصل Push إلى جهازك بنجاح/);
});

test("stale account subscriptions are cleaned up",()=>{
  assert.match(route,/result\.status===404\|\|result\.status===410/);
  assert.match(route,/DELETE FROM navixa_push_subscriptions WHERE endpoint=\? AND user_id=\?/);
});
