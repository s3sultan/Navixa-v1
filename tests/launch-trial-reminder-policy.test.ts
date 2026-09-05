import test from "node:test";
import assert from "node:assert/strict";
import {shouldShowLaunchTrialReminder} from "../app/launchTrialReminderPolicy";

test("subscription reminder only shows during Wednesday-to-cutoff phase",()=>{assert.equal(shouldShowLaunchTrialReminder("trial"),false);assert.equal(shouldShowLaunchTrialReminder("reminder"),true);assert.equal(shouldShowLaunchTrialReminder("ended"),false);});
