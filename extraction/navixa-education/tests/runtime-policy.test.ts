import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_EDUCATION_RUNTIME_POLICY,
  assertSafeEducationRuntimePolicy,
  type EducationRuntimePolicy,
} from "../src/runtimePolicy.ts";

test("Education runtime defaults are fail-closed and standalone", () => {
  assert.deepEqual(DEFAULT_EDUCATION_RUNTIME_POLICY, {
    mode: "test",
    allowProductionDelivery: false,
    allowSharedNavixaDatabase: false,
    requireVerifiedOfficialSources: true,
    requireExplicitTestRecipients: true,
  });
  assert.equal(assertSafeEducationRuntimePolicy({ ...DEFAULT_EDUCATION_RUNTIME_POLICY }), true);
});

test("shared NAVIXA database is always rejected", () => {
  assert.throws(
    () => assertSafeEducationRuntimePolicy({ ...DEFAULT_EDUCATION_RUNTIME_POLICY, allowSharedNavixaDatabase: true }),
    /education_shared_navixa_database_forbidden/,
  );
});

test("live mode requires explicit production authorization", () => {
  const unsafe: EducationRuntimePolicy = {
    ...DEFAULT_EDUCATION_RUNTIME_POLICY,
    mode: "live",
  };
  assert.throws(() => assertSafeEducationRuntimePolicy(unsafe), /education_live_delivery_not_authorized/);
});

test("test mode requires an explicit recipient allowlist", () => {
  assert.throws(
    () => assertSafeEducationRuntimePolicy({ ...DEFAULT_EDUCATION_RUNTIME_POLICY, requireExplicitTestRecipients: false }),
    /education_test_allowlist_required/,
  );
});
