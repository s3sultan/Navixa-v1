import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_COPY} from "../app/launchTrialCopy";
test("reminder title says the free trial is still active",()=>{assert.equal(LAUNCH_TRIAL_COPY.title,"الفترة التجريبية المجانية مستمرة");});
