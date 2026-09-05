import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_PLAN_USAGE_LIMITS,normalizeUsageLimit} from "../app/planUsageLimits";

test("trial heavy services have conservative finite defaults",()=>{
  assert.ok(DEFAULT_PLAN_USAGE_LIMITS.trial_summarization_minutes>0);
  assert.ok(DEFAULT_PLAN_USAGE_LIMITS.trial_summarization_minutes<DEFAULT_PLAN_USAGE_LIMITS.himma_summarization_minutes);
  assert.ok(DEFAULT_PLAN_USAGE_LIMITS.trial_ai_requests<DEFAULT_PLAN_USAGE_LIMITS.himma_ai_requests);
});

test("usage limits reject unsafe values",()=>{
  assert.equal(normalizeUsageLimit(-1,20),20);
  assert.equal(normalizeUsageLimit("bad",20),20);
  assert.equal(normalizeUsageLimit(999999,20),100000);
});
