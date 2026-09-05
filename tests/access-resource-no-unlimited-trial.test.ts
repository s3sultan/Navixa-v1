import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_PLAN_USAGE_LIMITS} from "../app/planUsageLimits";
test("trial heavy-service defaults are never unlimited",()=>{for(const value of [DEFAULT_PLAN_USAGE_LIMITS.trial_summarization_minutes,DEFAULT_PLAN_USAGE_LIMITS.trial_ai_requests]){assert.ok(Number.isFinite(value));assert.ok(value>0);assert.ok(value<1000);}});
