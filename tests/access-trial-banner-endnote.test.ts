import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_COPY} from "../app/launchTrialCopy";
test("reminder end note says expiry is automatic",()=>{assert.match(LAUNCH_TRIAL_COPY.endNote,/تنتهي تلقائيًا/);});
