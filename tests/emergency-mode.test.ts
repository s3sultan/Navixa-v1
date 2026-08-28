import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("emergency mode foundation is isolated, admin-only, and notification-dry-run", async () => {
  const [core, route, plan] = await Promise.all([
    read("worker/emergencyMode.ts"),
    read("app/api/admin/emergency-mode/route.ts"),
    read("docs/emergency-mode-plan.md"),
  ]);

  assert.match(core, /healthy.*degraded.*outage.*security-hold.*recovery/s);
  assert.match(core, /navixa_emergency_incidents/);
  assert.match(core, /navixa_emergency_events/);
  assert.match(core, /start_notified_at/);
  assert.match(core, /recovery_notified_at/);
  assert.match(core, /claimIncidentNotification/);
  assert.doesNotMatch(core, /RESEND_API_KEY|TELEGRAM_BOT_TOKEN|moyasar|payment/i);

  assert.match(route, /verifyAdminSessionToken/);
  assert.match(route, /isTrustedSameOriginRequest/);
  assert.match(route, /Cache-Control": "no-store/);
  assert.match(route, /dryRunNotifications: true/);
  assert.match(route, /notificationsSent: false/);
  assert.doesNotMatch(route, /sendOfficialTelegramMessage|api\.resend\.com|billing|moyasar/i);

  assert.match(plan, /Payment remains disabled/);
  assert.match(plan, /short-lived signed access grants/);
  assert.match(plan, /Do not assume `chatgpt\.site` can remove ChatGPT-account requirements/);
});
