import test from "node:test";
import assert from "node:assert/strict";
import {launchTrialPhase} from "../app/launchTrial";
test("trial becomes reminder Wednesday and ends exactly Saturday 4pm",()=>{assert.equal(launchTrialPhase(new Date("2026-09-08T23:59:59+03:00")),"trial");assert.equal(launchTrialPhase(new Date("2026-09-09T00:00:00+03:00")),"reminder");assert.equal(launchTrialPhase(new Date("2026-09-12T15:59:59+03:00")),"reminder");assert.equal(launchTrialPhase(new Date("2026-09-12T16:00:00+03:00")),"ended");});
