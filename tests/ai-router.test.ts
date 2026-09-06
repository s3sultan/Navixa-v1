import test from "node:test";
import assert from "node:assert/strict";
import { routeAiRequest } from "../lib/ai/router";
import { canUseAi, getAiBudgetPolicy } from "../lib/ai/budget";
import { validateAiInput } from "../lib/ai/security";

test("routes simple extraction to economy", () => {
  assert.equal(routeAiRequest({ project: "core", task: "extract", userPlan: "himma" }).tier, "economy");
});

test("routes kids through controlled balanced tier", () => {
  const decision = routeAiRequest({ project: "kids", task: "chat", userPlan: "himma" });
  assert.equal(decision.tier, "balanced");
  assert.ok(decision.maxOutputTokens <= 900);
});

test("advanced tier is unavailable to free policy", () => {
  const policy = getAiBudgetPolicy("free", "core");
  assert.equal(canUseAi(policy, { requestsToday: 0, tokensToday: 0 }, "advanced", 1000).allowed, false);
});

test("budget guard rejects exhausted request quota", () => {
  const policy = getAiBudgetPolicy("azm", "core");
  assert.equal(canUseAi(policy, { requestsToday: policy.dailyRequestLimit, tokensToday: 0 }, "balanced", 100).allowed, false);
});

test("privacy guard blocks obvious secrets", () => {
  assert.equal(validateAiInput("api_key=super-secret-value").ok, false);
});
