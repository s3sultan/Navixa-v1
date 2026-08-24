import assert from "node:assert/strict";
import test from "node:test";
import { isFeatureAccessActive } from "../app/featureAccess.ts";

test("feature access requires both a signed-in account and active trial or subscription", () => {
  assert.equal(isFeatureAccessActive(null), false);
  assert.equal(isFeatureAccessActive({ enabled: true, signedIn: false, plus: { status: "trial" } }), false);
  assert.equal(isFeatureAccessActive({ enabled: true, signedIn: true, plus: null }), false);
  assert.equal(isFeatureAccessActive({ enabled: true, signedIn: true, plus: { status: "waitlist" } }), false);
  assert.equal(isFeatureAccessActive({ enabled: true, signedIn: true, plus: { status: "trial" } }), true);
  assert.equal(isFeatureAccessActive({ enabled: true, signedIn: true, plus: { status: "active" } }), true);
});
