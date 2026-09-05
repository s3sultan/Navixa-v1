import test from "node:test";
import assert from "node:assert/strict";
import {launchTrialPhase} from "../app/launchTrial";
test("launch trial is active from Saturday September 5",()=>{assert.equal(launchTrialPhase(new Date("2026-09-04T23:59:59+03:00")),"before");assert.equal(launchTrialPhase(new Date("2026-09-05T00:00:00+03:00")),"trial");});
