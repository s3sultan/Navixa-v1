import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { issuePlanBGrant, planBMayOpen, resolvePlanBUrl, verifyPlanBGrant } from "../worker/planBAccess.ts";
import { emergencyEntitlementKey, type EmergencyEntitlementSnapshot } from "../worker/emergencyEntitlements.ts";
import { handlePlanBRequest, runIndependentMonitor, verifyPlanBGrantToken } from "../plan-b/worker.mjs";

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

test("Plan B only accepts NAVIXA-controlled HTTPS fallbacks and emergency access excludes security hold", () => {
  assert.equal(resolvePlanBUrl(undefined), null);
  assert.equal(resolvePlanBUrl("http://fallback.navixasa.com"), null);
  assert.equal(resolvePlanBUrl("https://navixa.s2shug.chatgpt.site"), null);
  assert.equal(resolvePlanBUrl("https://navixasa.com.evil.example"), null);
  assert.equal(resolvePlanBUrl("https://user:pass@fallback.navixasa.com"), null);
  assert.equal(resolvePlanBUrl("https://fallback.navixasa.com:8443"), null);
  assert.equal(resolvePlanBUrl("https://navixasa.com/plan-b#private"), "https://navixasa.com/plan-b");
  assert.equal(resolvePlanBUrl("https://fallback.navixasa.com/"), "https://fallback.navixasa.com");
  assert.equal(resolvePlanBUrl("https://backup.navixasa.com/"), "https://backup.navixasa.com");
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
  const currentSnapshot = await snapshot();
  await assert.rejects(() => issuePlanBGrant({
    snapshot: currentSnapshot, email: "other@example.com", entitlementSecret, signingSecret,
    emergencyState: "outage", incidentId: "incident-1", now,
  }), /plus_required/);
  await assert.rejects(() => issuePlanBGrant({
    snapshot: currentSnapshot, email, entitlementSecret, signingSecret,
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

test("independent Plan B worker verifies grants without D1 and redacts entitlement identity", async () => {
  const liveNow = new Date();
  const liveEmail = "plan-b-worker-test@navixa.invalid";
  const liveSnapshot: EmergencyEntitlementSnapshot = {
    version: 1,
    generatedAt: liveNow.toISOString(),
    records: [{
      entitlementKey: await emergencyEntitlementKey(liveEmail, entitlementSecret),
      activeUntil: new Date(liveNow.getTime() + 60 * 60 * 1000).toISOString(),
    }],
  };
  const token = await issuePlanBGrant({
    snapshot: liveSnapshot,
    email: liveEmail,
    entitlementSecret,
    signingSecret,
    emergencyState: "outage",
    incidentId: "worker-test",
    now: liveNow,
    ttlSeconds: 300,
  });

  const workerPayload = await verifyPlanBGrantToken(token, signingSecret, new Date(liveNow.getTime() + 60_000));
  assert.equal(workerPayload?.incident, "worker-test");

  const response = await handlePlanBRequest(new Request("https://backup.navixasa.com/api/verify", {
    method: "POST",
    headers: { "Origin": "https://backup.navixasa.com", "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }), { NAVIXA_PLAN_B_SIGNING_SECRET: signingSecret });
  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.incident, "worker-test");
  assert.equal("sub" in body, false);

  const wrongOrigin = await handlePlanBRequest(new Request("https://backup.navixasa.com/api/verify", {
    method: "POST",
    headers: { "Origin": "https://evil.example", "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }), { NAVIXA_PLAN_B_SIGNING_SECRET: signingSecret });
  assert.equal(wrongOrigin.status, 403);
});

test("independent monitor confirms repeated outage and recovery using R2 state only", async () => {
  const objects = new Map<string, string>();
  const STATE = {
    async get(key: string) {
      const value = objects.get(key);
      return value === undefined ? null : { text: async () => value };
    },
    async put(key: string, value: string) { objects.set(key, value); },
  };
  const fetchFor = (canonicalHealthy: boolean, originHealthy = true) => async (input: string | URL | Request) => {
    const url = String(input);
    const healthy = url.includes("navixasa.com/api/healthz") ? canonicalHealthy : originHealthy;
    return new Response(JSON.stringify({ ok: healthy, service: "navixa-primary" }), {
      status: healthy ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    });
  };

  const first = await runIndependentMonitor({ STATE }, { fetchImpl: fetchFor(false), now: new Date("2026-09-10T18:00:00Z") });
  assert.equal(first.state, "degraded");
  const second = await runIndependentMonitor({ STATE }, { fetchImpl: fetchFor(false), now: new Date("2026-09-10T18:01:00Z") });
  assert.equal(second.state, "degraded");
  const third = await runIndependentMonitor({ STATE }, { fetchImpl: fetchFor(false), now: new Date("2026-09-10T18:02:00Z") });
  assert.equal(third.state, "outage");
  assert.ok(third.incidentId);

  await runIndependentMonitor({ STATE }, { fetchImpl: fetchFor(true), now: new Date("2026-09-10T18:03:00Z") });
  await runIndependentMonitor({ STATE }, { fetchImpl: fetchFor(true), now: new Date("2026-09-10T18:04:00Z") });
  const recovery = await runIndependentMonitor({ STATE }, { fetchImpl: fetchFor(true), now: new Date("2026-09-10T18:05:00Z") });
  assert.equal(recovery.state, "recovery");
  assert.equal(recovery.incidentId, third.incidentId);
  const healthy = await runIndependentMonitor({ STATE }, { fetchImpl: fetchFor(true), now: new Date("2026-09-10T18:06:00Z") });
  assert.equal(healthy.state, "healthy");
  assert.equal(healthy.incidentId, "");

  const noStore = await runIndependentMonitor({}, { fetchImpl: fetchFor(false), now });
  assert.deepEqual(noStore, { ok: false, error: "state_store_not_ready" });
});

test("Plan B monitor uses a separate R2 bucket and primary exposes a D1-backed no-store probe", async () => {
  const [wrangler, healthRoute] = await Promise.all([
    readFile(new URL("../plan-b/wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../app/api/healthz/route.ts", import.meta.url), "utf8"),
  ]);
  assert.ok(wrangler.includes("backup.navixasa.com"));
  assert.match(wrangler, /"custom_domain": true/);
  assert.match(wrangler, /"binding": "STATE"/);
  assert.match(wrangler, /"bucket_name": "navixa-plan-b-state"/);
  assert.match(wrangler, /"crons": \["\* \* \* \* \*"\]/);
  assert.doesNotMatch(wrangler, /d1_databases|navixa-db|"DB"/);

  assert.match(healthRoute, /SELECT 1 AS ok/);
  assert.match(healthRoute, /navixa-primary/);
  assert.match(healthRoute, /no-store/);
  assert.doesNotMatch(healthRoute, /ADMIN_JWT_SECRET|RESEND|TELEGRAM|email|subscriber|payment/i);
});