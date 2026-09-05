import test from "node:test";
import assert from "node:assert/strict";
import {launchTrialPhase} from "../app/launchTrial";
test("notice window covers Wednesday through Saturday 4pm only",()=>{assert.notEqual(launchTrialPhase(new Date("2026-09-08T12:00:00+03:00")),"reminder");assert.equal(launchTrialPhase(new Date("2026-09-09T12:00:00+03:00")),"reminder");assert.equal(launchTrialPhase(new Date("2026-09-12T15:59:59+03:00")),"reminder");assert.notEqual(launchTrialPhase(new Date("2026-09-12T16:00:00+03:00")),"reminder");});
