import test from "node:test";
import assert from "node:assert/strict";
import {launchTrialRemainingMs} from "../app/launchTrial";
test("trial remaining time never becomes negative",()=>{assert.ok(launchTrialRemainingMs(new Date("2026-09-12T15:59:59+03:00"))>0);assert.equal(launchTrialRemainingMs(new Date("2026-09-12T16:00:00+03:00")),0);assert.equal(launchTrialRemainingMs(new Date("2026-09-13T16:00:00+03:00")),0);});
