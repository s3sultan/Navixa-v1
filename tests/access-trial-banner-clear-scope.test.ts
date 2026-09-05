import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_COPY} from "../app/launchTrialCopy";
test("reminder actions clearly distinguish full Himma from focused Azm",()=>{assert.match(LAUNCH_TRIAL_COPY.himma,/كامل NAVIXA/);assert.match(LAUNCH_TRIAL_COPY.azm,/مراقبة الشاشة ونداء الاسم/);});
