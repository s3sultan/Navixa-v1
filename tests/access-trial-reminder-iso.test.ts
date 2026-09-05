import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_REMINDER_START} from "../app/launchTrial";
test("reminder start is an unambiguous Saudi timestamp",()=>{assert.match(LAUNCH_TRIAL_REMINDER_START,/^2026-09-09T00:00:00\+03:00$/);});
