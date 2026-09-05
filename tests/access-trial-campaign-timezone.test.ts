import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_META} from "../app/launchTrialMeta";
test("launch campaign metadata uses Riyadh timezone",()=>{assert.equal(LAUNCH_TRIAL_META.timezone,"Asia/Riyadh");});
