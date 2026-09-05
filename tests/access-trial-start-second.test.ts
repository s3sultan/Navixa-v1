import test from "node:test";
import assert from "node:assert/strict";
import {launchTrialPhase} from "../app/launchTrial";
test("trial starts on the exact Saturday second",()=>{assert.equal(launchTrialPhase(new Date("2026-09-04T23:59:59.999+03:00")),"before");assert.equal(launchTrialPhase(new Date("2026-09-05T00:00:00.000+03:00")),"trial");});
