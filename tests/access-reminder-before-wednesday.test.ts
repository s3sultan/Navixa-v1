import test from "node:test";
import assert from "node:assert/strict";
import {shouldShowLaunchTrialReminder} from "../app/launchTrialReminderPolicy";
test("users are not nagged before Wednesday reminder phase",()=>{assert.equal(shouldShowLaunchTrialReminder("before"),false);assert.equal(shouldShowLaunchTrialReminder("trial"),false);});
