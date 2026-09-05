import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_COPY} from "../app/launchTrialCopy";
test("reminder uses public Arabic plan brands",()=>{assert.match(LAUNCH_TRIAL_COPY.himma,/هِمّة/);assert.match(LAUNCH_TRIAL_COPY.azm,/عَزْم/);});
