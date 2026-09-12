import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const route=await readFile(new URL("../app/api/push/events/route.ts",import.meta.url),"utf8");
const client=await readFile(new URL("../app/pushClient.ts",import.meta.url),"utf8");
const prefs=await readFile(new URL("../app/alertPrefs.ts",import.meta.url),"utf8");
const reminders=await readFile(new URL("../app/PersonalReminderEngine.tsx",import.meta.url),"utf8");

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
  assert.match(prefs,/sendNavixaFeaturePushEvent\(\{kind:"name_heard"/);
  assert.match(reminders,/kind:"screen_watch"/);
});

test("stale account subscriptions are cleaned up",()=>{
  assert.match(route,/result\.status===404\|\|result\.status===410/);
  assert.match(route,/DELETE FROM navixa_push_subscriptions WHERE endpoint=\? AND user_id=\?/);
});
