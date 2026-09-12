import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [healthNudge, personal, renewals, billing, matches] = await Promise.all([
  readFile(new URL("../app/HealthNudge.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/PersonalReminderEngine.tsx", import.meta.url), "utf8"),
  readFile(new URL("../worker/subscriptionRenewals.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/billing/webhook/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/matchPush.ts", import.meta.url), "utf8"),
]);

// Health activity reminders have one owner. The legacy nudge must never schedule
// another timer beside PersonalReminderEngine.
assert.doesNotMatch(healthNudge, /setTimeout|navixa-health-nudge|حان وقت الحركة/);
assert.match(healthNudge, /return null/);
assert.match(personal, /kind:"break"/);
assert.match(personal, /kind:"water"/);
assert.match(personal, /kind:"eye"/);
assert.match(personal, /showNavixaDeviceNotification/);

// Subscription renewal is a deterministic server event and therefore supports
// background Push in addition to existing email/Telegram delivery.
assert.match(renewals, /DeliveryChannel = "email" \| "telegram" \| "push"/);
assert.match(renewals, /sendFeaturePush/);
assert.match(renewals, /kind: "billing"/);
assert.match(renewals, /createOrClaimDelivery\(env\.DB, subscriber, type, "push"/);
assert.match(renewals, /pushSent/);
assert.match(renewals, /status === 404 \|\| result\.status === 410/);

// A payment activation Push is sent only after the live verified activation path,
// and Push failure cannot roll back a confirmed payment.
assert.match(billing, /notifyActivation/);
assert.match(billing, /if \(requestedLive\) await notifyActivation/);
assert.match(billing, /kind: "billing"/);
assert.match(billing, /\.catch\(\(\) => 0\)/);
assert.doesNotMatch(billing, /body\.userId|body\.user_id/);

// Match notifications already have a dedicated server Push worker and should not
// be duplicated by the unified reminder worker.
assert.match(matches, /sendFeaturePush/);
assert.match(matches, /navixa_push_subscriptions/);

console.log("notification source audit contract: ok");
