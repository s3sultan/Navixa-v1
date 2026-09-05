import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_START} from "../app/launchTrial";
test("trial start is an unambiguous Saudi timestamp",()=>{assert.match(LAUNCH_TRIAL_START,/^2026-09-05T00:00:00\+03:00$/);});
