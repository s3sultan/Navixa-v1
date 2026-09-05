import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_COPY} from "../app/launchTrialCopy";
test("reminder body states Saturday September 12 cutoff",()=>{assert.match(LAUNCH_TRIAL_COPY.body,/السبت 12 سبتمبر الساعة 4:00 م/);});
