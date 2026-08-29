import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("emergency mode is admin-only and sends only approved Plus continuity alerts", async () => {
  const [core, route, notifications, preferences, plan] = await Promise.all([
    read("worker/emergencyMode.ts"),
    read("app/api/admin/emergency-mode/route.ts"),
    read("worker/emergencyNotifications.ts"),
    read("app/api/account/telegram/preferences/route.ts"),
    read("docs/emergency-mode-plan.md"),
  ]);

  assert.match(core, /healthy.*degraded.*outage.*security-hold.*recovery/s);
  assert.match(core, /navixa_emergency_incidents/);
  assert.match(core, /start_notified_at/);
  assert.match(core, /recovery_notified_at/);
  assert.match(core, /claimIncidentNotification/);
  assert.doesNotMatch(core, /RESEND_API_KEY|TELEGRAM_BOT_TOKEN|moyasar|payment/i);

  assert.match(route, /verifyAdminSessionToken/);
  assert.match(route, /isTrustedSameOriginRequest/);
  assert.match(route, /deliverEmergencyIncidentNotifications/);
  assert.match(route, /state\.state === "outage" \|\| state\.state === "recovery"/);
  assert.match(route, /Cache-Control": "no-store/);
  assert.doesNotMatch(route, /billing|moyasar|payment/i);

  assert.match(notifications, /https:\/\/navixa\.s2shug\.chatgpt\.site/);
  assert.match(notifications, /status='active'/);
  assert.match(notifications, /subscription_ends_at>\?/);
  assert.match(notifications, /notification_type='emergency'/);
  assert.match(notifications, /navixa_emergency_deliveries/);
  assert.match(notifications, /INSERT OR IGNORE INTO navixa_emergency_deliveries/);
  assert.match(notifications, /status='failed'/);
  assert.match(notifications, /status='sent'/);
  assert.match(notifications, /attempts=attempts\+1/);
  assert.match(notifications, /input\.state === "outage"/);
  assert.match(notifications, /input\.state === "recovery"/);
  assert.doesNotMatch(notifications, /status IN \('trial','active'\)|moyasar|payment/i);

  assert.match(preferences, /"renewal","emergency"/);
  assert.match(plan, /Payment remains disabled/);
  assert.match(plan, /short-lived signed access grants/);
  assert.match(plan, /Do not assume `chatgpt\.site` can remove ChatGPT-account requirements/);
});
