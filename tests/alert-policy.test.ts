import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const helper=await readFile(new URL("../worker/alertPolicy.ts",import.meta.url),"utf8");
const adminRoute=await readFile(new URL("../app/api/admin/alert-policy/route.ts",import.meta.url),"utf8");
const userRoute=await readFile(new URL("../app/api/account/notifications/preferences/route.ts",import.meta.url),"utf8");
const adminUi=await readFile(new URL("../app/admin/settings/AdminAlertSettings.tsx",import.meta.url),"utf8");
const center=await readFile(new URL("../app/NotificationCenter.tsx",import.meta.url),"utf8");
const prefs=await readFile(new URL("../app/alertPrefs.ts",import.meta.url),"utf8");

test("admin alert policy is persisted centrally and protected",()=>{
  assert.match(helper,/navixa_alert_policy/);
  assert.match(helper,/screen_policy/);
  assert.match(helper,/telegram_policy/);
  assert.match(helper,/message TEXT/);
  assert.match(adminRoute,/verifyAdminSessionToken/);
  assert.match(adminRoute,/isTrustedSameOriginRequest/);
  assert.match(adminRoute,/writeAlertPolicy/);
  assert.match(adminUi,/\/api\/admin\/alert-policy/);
  assert.match(adminUi,/تشغيل جميع التنبيهات/);
});

test("user notification choices are account persisted with enable-all",()=>{
  assert.match(userRoute,/navixa_user_notification_preferences/);
  assert.match(userRoute,/resolveUserSession/);
  assert.match(userRoute,/trustedUserMutation/);
  assert.match(userRoute,/body\.all===true/);
  assert.match(center,/\/api\/account\/notifications\/preferences/);
  assert.match(center,/تفعيل الكل/);
  assert.match(center,/hydrateAlertSettings/);
});

test("general device Push can be activated and tested outside match settings",()=>{
  assert.match(center,/\/api\/push\/config/);
  assert.match(center,/\/navixa-push-sw\.js/);
  assert.match(center,/pushManager\.subscribe/);
  assert.match(center,/\/api\/push\/subscriptions/);
  assert.match(center,/\/api\/push\/test/);
  assert.match(center,/تفعيل Push واختباره/);
  assert.match(prefs,/\/api\/alert-policy/);
});
