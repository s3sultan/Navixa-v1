import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

const FREE_ACCESS_END = "2026-09-19T20:59:59.999Z";

test("free access runs through Sep 19 Riyadh without extending paid-only entitlements", async () => {
  const [login, migration, portfolio, emergency] = await Promise.all([
    read("app/api/account/code/verify/route.ts"),
    read("migrations/0050_extend_free_trial_to_20260919.sql"),
    read("worker/portfolioAccess.ts"),
    read("worker/emergencyEntitlements.ts"),
  ]);

  assert.match(login, new RegExp(FREE_ACCESS_END.replace(/[.]/g, "\\.")));
  assert.match(login, /Date\.now\(\) >= campaignEnd/);
  assert.match(migration, /WHERE status = 'trial'/);
  assert.match(migration, new RegExp(FREE_ACCESS_END.replace(/[.]/g, "\\.")));
  assert.doesNotMatch(migration, /status\s*=\s*'active'/);

  // The temporary campaign must not turn free/trial users into paid portfolio
  // members or emergency-mode subscribers.
  assert.match(portfolio, /status='active'/);
  assert.doesNotMatch(portfolio, /status IN \('trial','active'\)/);
  assert.match(emergency, /status='active'/);
  assert.doesNotMatch(emergency, /status IN \('trial','active'\)/);
});
