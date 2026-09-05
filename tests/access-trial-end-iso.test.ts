import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_END} from "../app/launchTrial";
test("trial end is an unambiguous offset-aware timestamp",()=>{assert.match(LAUNCH_TRIAL_END,/^2026-09-12T16:00:00\+03:00$/);assert.ok(Number.isFinite(Date.parse(LAUNCH_TRIAL_END)));});
