import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root=new URL("../",import.meta.url);
const route=fs.readFileSync(new URL("app/api/device-control/route.ts",root),"utf8");
const agent=fs.readFileSync(new URL("app/DeviceControlAgent.tsx",root),"utf8");
const panel=fs.readFileSync(new URL("app/account/DeviceControlPanel.tsx",root),"utf8");
const migration=fs.readFileSync(new URL("migrations/0056_device_control.sql",root),"utf8");

test("device control is an allowlisted short-lived queue",()=>{
  assert.match(migration,/navixa_device_control_requests/);
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
