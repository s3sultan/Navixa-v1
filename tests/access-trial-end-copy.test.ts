import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_COPY} from "../app/launchTrialCopy";
test("trial reminder explicitly states Saudi cutoff time",()=>{assert.match(LAUNCH_TRIAL_COPY.endNote,/4:00 م بتوقيت السعودية/);});
