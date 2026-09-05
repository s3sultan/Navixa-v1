import test from "node:test";
import assert from "node:assert/strict";
import {NAVIXA_ACCESS_MODEL} from "../app/accessModel";
import {DEFAULT_PLAN_USAGE_LIMITS} from "../app/planUsageLimits";
test("trial is full-scope but resource limited",()=>{assert.equal(NAVIXA_ACCESS_MODEL.trial.scope,"full-limited");assert.ok(DEFAULT_PLAN_USAGE_LIMITS.trial_summarization_minutes>0);assert.ok(DEFAULT_PLAN_USAGE_LIMITS.trial_summarization_minutes<DEFAULT_PLAN_USAGE_LIMITS.himma_summarization_minutes);});
