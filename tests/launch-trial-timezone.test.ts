import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_END,NAVIXA_TIME_ZONE} from "../app/launchTrial";
test("launch cutoff is explicitly Saudi time",()=>{assert.equal(NAVIXA_TIME_ZONE,"Asia/Riyadh");assert.ok(LAUNCH_TRIAL_END.endsWith("+03:00"));assert.equal(Date.parse(LAUNCH_TRIAL_END),Date.parse("2026-09-12T13:00:00Z"));});
