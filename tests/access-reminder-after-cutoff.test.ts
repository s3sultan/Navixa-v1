import test from "node:test";
import assert from "node:assert/strict";
import {shouldShowLaunchTrialReminder} from "../app/launchTrialReminderPolicy";
test("trial reminder disappears after cutoff",()=>{assert.equal(shouldShowLaunchTrialReminder("ended"),false);});
