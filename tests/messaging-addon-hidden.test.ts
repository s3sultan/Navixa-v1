import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MESSAGING_POLICY, canExposeMessagingAddon, messagingPolicyFromValues } from "../worker/notifications/messagingPolicy.ts";

test("premium messaging addon is hidden and disabled by default", () => {
  assert.equal(DEFAULT_MESSAGING_POLICY.publicVisible, false);
  assert.equal(DEFAULT_MESSAGING_POLICY.enabled, false);
  assert.equal(DEFAULT_MESSAGING_POLICY.monthlyQuota, 0);
  assert.equal(DEFAULT_MESSAGING_POLICY.cooldownSeconds, 300);
  assert.equal(canExposeMessagingAddon(DEFAULT_MESSAGING_POLICY), false);
});

test("messaging limits are configurable without exposing the addon", () => {
  const policy = messagingPolicyFromValues({ enabled: true, publicVisible: false, monthlyQuota: 100, cooldownSeconds: 600 });
  assert.equal(policy.monthlyQuota, 100);
  assert.equal(policy.cooldownSeconds, 600);
  assert.equal(canExposeMessagingAddon(policy), false);
  assert.ok(policy.allowedEvents.includes("name_heard"));
  assert.ok(policy.allowedEvents.includes("screen_watch"));
});
