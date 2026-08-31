import assert from "node:assert/strict";
import test from "node:test";
import { isCriticalMessagingEvent, isPremiumMessagingEvent, requiresMessagingAllowance } from "../worker/notifications/messagingQuota.ts";
import { DEFAULT_MESSAGING_POLICY, canExposeMessagingAddon } from "../worker/notifications/messagingPolicy.ts";

test("SMS and WhatsApp premium event policy stays narrow", () => {
  assert.equal(isPremiumMessagingEvent("name_heard"), true);
  assert.equal(isPremiumMessagingEvent("screen_watch"), true);
  assert.equal(isPremiumMessagingEvent("security"), true);
  assert.equal(isPremiumMessagingEvent("daily_water"), false);
  assert.equal(requiresMessagingAllowance("name_heard"), true);
  assert.equal(requiresMessagingAllowance("screen_watch"), true);
  assert.equal(isCriticalMessagingEvent("otp"), true);
  assert.equal(isCriticalMessagingEvent("billing"), true);
});

test("messaging addon remains invisible until explicitly launched", () => {
  assert.equal(DEFAULT_MESSAGING_POLICY.publicVisible, false);
  assert.equal(DEFAULT_MESSAGING_POLICY.enabled, false);
  assert.equal(canExposeMessagingAddon(DEFAULT_MESSAGING_POLICY), false);
});
