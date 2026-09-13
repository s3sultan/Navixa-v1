import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root=new URL("../",import.meta.url);
const route=fs.readFileSync(new URL("app/api/device-control/route.ts",root),"utf8");
const pushSubscriptions=fs.readFileSync(new URL("app/api/push/subscriptions/route.ts",root),"utf8");
const agent=fs.readFileSync(new URL("app/DeviceControlAgent.tsx",root),"utf8");
const panel=fs.readFileSync(new URL("app/account/DeviceControlPanel.tsx",root),"utf8");
const migration=fs.readFileSync(new URL("migrations/0056_device_control.sql",root),"utf8");
const pushBindingMigration=fs.readFileSync(new URL("migrations/0057_push_device_binding.sql",root),"utf8");
const layout=fs.readFileSync(new URL("app/layout.tsx",root),"utf8");
const account=fs.readFileSync(new URL("app/account/page.tsx",root),"utf8");

test("device control is an allowlisted short-lived queue",()=>{
  assert.match(migration,/navixa_device_control_requests/);
  assert.match(migration,/user_id TEXT NOT NULL/);
  assert.match(migration,/prepare_name_listener/);
  assert.match(migration,/prepare_screen_watch/);
  assert.match(migration,/open_alerts/);
  assert.match(migration,/open_account_sync/);
  assert.match(route,/REQUEST_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(route,/MAX_PENDING = 8/);
  assert.match(route,/allowedCommands\.has/);
  assert.doesNotMatch(route,/eval\(|new Function|body\.url|body\.payload|body\.script/);
});

test("control authority comes from the persisted session device class",()=>{
  assert.match(route,/readUserSessionToken/);
  assert.match(route,/hashOpaqueValue/);
  assert.match(route,/SELECT device_class FROM navixa_user_sessions WHERE token_hash=\? AND user_id=\?/);
  assert.doesNotMatch(route,/resolveUserDeviceClass/);
  assert.match(route,/deviceClass !== "mobile"/);
  assert.match(route,/deviceClass !== "computer"/);
});

test("mutations are same-origin and every request remains user scoped",()=>{
  assert.match(route,/trustedUserMutation\(request\)/);
  assert.match(route,/source_device_class='mobile'/);
  assert.match(route,/target_device_class='computer'/);
  assert.match(route,/WHERE id=\? AND user_id=\? AND target_device_class='computer'/);
  assert.match(route,/WHERE user_id=\? AND target_device_class='computer'/);
  assert.match(route,/Cache-Control": "private, no-store/);
  assert.match(route,/Vary": "Cookie/);
});

test("duplicate live commands are coalesced and expired commands are explicit",()=>{
  assert.match(route,/reused: true/);
  assert.match(route,/status: "expired"/);
  assert.match(route,/command=\? AND status='pending' AND expires_at>\?/);
  assert.match(panel,/انتهت المهلة/);
  assert.match(panel,/لم نكرر إرساله/);
});

test("Push subscriptions bind to the authenticated device session",()=>{
  assert.match(pushBindingMigration,/device_class TEXT NOT NULL DEFAULT ''/);
  assert.match(pushBindingMigration,/device_session_id TEXT NOT NULL DEFAULT ''/);
  assert.match(pushBindingMigration,/idx_navixa_push_user_device/);
  assert.match(pushSubscriptions,/SELECT id,device_class FROM navixa_user_sessions WHERE token_hash=\? AND user_id=\?/);
  assert.match(pushSubscriptions,/device_session_id/);
  assert.match(pushSubscriptions,/device_class/);
  assert.match(pushSubscriptions,/deviceBound:Boolean\(userId&&device\)/);
  assert.doesNotMatch(pushSubscriptions,/body\.deviceClass|body\.deviceSessionId/);
});

test("mobile control Push targets only an active computer session",()=>{
  assert.match(route,/JOIN navixa_user_sessions s ON s\.id=p\.device_session_id/);
  assert.match(route,/p\.user_id=\? AND p\.device_class='computer' AND p\.enabled=1/);
  assert.match(route,/s\.device_class='computer' AND s\.revoked_at='' AND s\.expires_at>\?/);
  assert.match(route,/sendFeaturePush/);
  assert.match(route,/title:"NAVIXA · طلب من جوالك"/);
  assert.match(route,/requireInteraction:true/);
  assert.match(route,/ttl:300/);
  assert.match(route,/DELETE FROM navixa_push_subscriptions WHERE endpoint=\? AND user_id=\?/);
  assert.doesNotMatch(route,/getDisplayMedia|getUserMedia|SpeechRecognition/);
});

test("Push failure keeps the durable control queue as fallback",()=>{
  assert.match(route,/catch\{return 0\}/);
  assert.match(route,/pushDelivered/);
  assert.match(panel,/إذا لم يكن Push مفعّلًا على الكمبيوتر فسيظهر عند فتح NAVIXA/);
  assert.match(panel,/وصل Push إلى الكمبيوتر النشط/);
});

test("computer agent polls only an authenticated computer while visible",()=>{
  assert.match(agent,/\/api\/account\/session/);
  assert.match(agent,/if\(!cancelled&&computer\)timer=window\.setInterval/);
  assert.match(agent,/document\.visibilityState===\"visible\"/);
  assert.match(agent,/if\(p\.deviceClass!==\"computer\"\)return false/);
});

test("computer agent requires a visible user action for sensitive tools",()=>{
  assert.doesNotMatch(agent,/getDisplayMedia|getUserMedia|MediaRecorder|SpeechRecognition/);
  assert.match(agent,/اختيار الشاشة أو التبويب يجب أن يتم منك/);
  assert.match(agent,/لا يشغّل ميكروفونًا أو شاشة من دونك/);
  assert.match(agent,/onClick=\{\(\)=>void finish\("acknowledged",true\)\}/);
  assert.match(agent,/window\.location\.assign/);
});

test("mobile account panel never sends sync credentials through device control",()=>{
  assert.match(panel,/\/api\/device-control/);
  assert.match(panel,/action:"create",command/);
  assert.match(panel,/كلمة تشفير المزامنة لا تنتقل بين الجهازين/);
  assert.doesNotMatch(panel,/passphrase|syncPassphrase|cipher|iv:/);
});

test("device control surfaces are mounted in the real app",()=>{
  assert.match(layout,/DeviceControlAgent/);
  assert.match(account,/DeviceControlPanel/);
});
