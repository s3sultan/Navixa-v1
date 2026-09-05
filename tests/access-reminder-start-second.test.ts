import test from "node:test";
import assert from "node:assert/strict";
import {launchTrialPhase} from "../app/launchTrial";
test("reminder starts on the exact Wednesday second",()=>{assert.equal(launchTrialPhase(new Date("2026-09-08T23:59:59.999+03:00")),"trial");assert.equal(launchTrialPhase(new Date("2026-09-09T00:00:00.000+03:00")),"reminder");});
