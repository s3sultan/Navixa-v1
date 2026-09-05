import test from "node:test";
import assert from "node:assert/strict";
import {launchTrialReminderState} from "../app/launchTrialReminder";
test("reminder turns on Wednesday and off exactly at cutoff",()=>{assert.equal(launchTrialReminderState(new Date("2026-09-08T23:59:59+03:00")).visible,false);assert.equal(launchTrialReminderState(new Date("2026-09-09T00:00:00+03:00")).visible,true);assert.equal(launchTrialReminderState(new Date("2026-09-12T16:00:00+03:00")).visible,false);});
