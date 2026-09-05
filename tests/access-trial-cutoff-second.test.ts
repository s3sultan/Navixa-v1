import test from "node:test";
import assert from "node:assert/strict";
import {launchTrialPhase} from "../app/launchTrial";
test("cutoff changes on the exact second",()=>{assert.equal(launchTrialPhase(new Date("2026-09-12T15:59:59.999+03:00")),"reminder");assert.equal(launchTrialPhase(new Date("2026-09-12T16:00:00.000+03:00")),"ended");});
