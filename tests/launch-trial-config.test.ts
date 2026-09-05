import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_CONFIG} from "../app/launchTrialConfig";

test("launch trial config keeps exact approved dates",()=>{
  assert.equal(LAUNCH_TRIAL_CONFIG.reminderStart,"2026-09-09T00:00:00+03:00");
  assert.equal(LAUNCH_TRIAL_CONFIG.end,"2026-09-12T16:00:00+03:00");
});
