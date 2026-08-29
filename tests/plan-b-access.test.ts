import assert from "node:assert/strict";
import test from "node:test";
import { issuePlanBGrant, PLAN_B_URL, planBMayOpen, verifyPlanBGrant } from "../worker/planBAccess.ts";
import { emergencyEntitlementKey, type EmergencyEntitlementSnapshot } from "../worker/emergencyEntitlements.ts";

const entitlementSecret = "entitlement-secret-for-tests-123456";
const signingSecret = "signing-secret-for-tests-123456789";
const email = "plus@example.com";
const now = new Date("2026-08-29T00:00:00.000Z");

async function snapshot(): Promise<EmergencyEntitlementSnapshot> {
  return {
    version: 1,
    generatedAt: now.toISOString(),
    records: [{
      entitlementKey: await emergencyEntitlementKey(email, entitlementSecret),
      activeUntil: "2026-09-29T00:00:00.000Z",
    }],
  };
}

test("Plan B URL stays canonical and emergency access excludes security hold", () => {
  assert.equal(PLAN_B_URL, "https://navixa.s2shug.chatgpt.site");
  assert.equal(planBMayOpen("healthy"), false);
  assert.equal(planBMayOpen("degraded"), false);
  assert.equal(planBMayOpen("security-hold"), false);
  assert.equal(planBMayOpen("outage"), true);
  assert.equal(planBMayOpen("recovery"), true);
});

test("active Plus can receive a short-lived incident-bound signed grant", async () => {
  const token = await issuePlanBGrant({
    snapshot: await snapshot(), email, entitlementSecret, signingSecret,
    emergencyState: "outage", incidentId: "incident-1", now, ttlSeconds: 600,
  });
  assert.doesNotMatch(token, /plus|example/i);
  const payload = await verifyPlanBGrant(token, signingSecret, new Date("2026-08-29T00:05:00.000Z"));
  assert.equal(payload?.incident, "incident-1");
  assert.ok(payload?.sub);
  assert.equal(await verifyPlanBGrant(token, signingSecret, new Date("2026-08-29T00:11:00.000Z")), null);
});

test("non-Plus and security-hold cannot obtain grants", async () => {
  await assert.rejects(() => issuePlanBGrant({
    snapshot: await snapshot(), email: "other@example.com", entitlementSecret, signingSecret,
    emergencyState: "outage", incidentId: "incident-1", now,
  }), /plus_required/);
  await assert.rejects(() => issuePlanBGrant({
    snapshot: await snapshot(), email, entitlementSecret, signingSecret,
    emergencyState: "security-hold", incidentId: "incident-1", now,
  }), /plan_b_not_open/);
});

test("tampered grants are rejected", async () => {
  const token = await issuePlanBGrant({
    snapshot: await snapshot(), email, entitlementSecret, signingSecret,
    emergencyState: "outage", incidentId: "incident-1", now,
  });
  assert.equal(await verifyPlanBGrant(`${token}x`, signingSecret, now), null);
});
