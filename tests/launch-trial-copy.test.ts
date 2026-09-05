import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_TRIAL_COPY} from "../app/launchTrialCopy";

test("launch reminder copy names approved plan scopes",()=>{
  assert.match(LAUNCH_TRIAL_COPY.himma,/كامل NAVIXA/);
  assert.match(LAUNCH_TRIAL_COPY.azm,/مراقبة الشاشة ونداء الاسم/);
  assert.match(LAUNCH_TRIAL_COPY.body,/السبت 12 سبتمبر/);
});
