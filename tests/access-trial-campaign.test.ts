import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_META} from "../app/launchTrialMeta";
test("launch trial has a stable campaign identifier",()=>{assert.equal(LAUNCH_TRIAL_META.campaign,"navixa-launch-trial-sep-2026");});
