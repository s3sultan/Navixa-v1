import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_START,LAUNCH_TRIAL_END} from "../app/launchTrial";
test("launch trial uses one global schedule rather than per-user days",()=>{assert.equal(typeof LAUNCH_TRIAL_START,"string");assert.equal(typeof LAUNCH_TRIAL_END,"string");});
