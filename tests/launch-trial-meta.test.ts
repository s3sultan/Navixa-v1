import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_META} from "../app/launchTrialMeta";
test("trial cutoff is independent of payment-provider readiness",()=>{assert.equal(LAUNCH_TRIAL_META.paymentDependency,false);assert.equal(LAUNCH_TRIAL_META.reminderMode,"onsite");});
