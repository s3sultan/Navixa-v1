import test from "node:test";
import assert from "node:assert/strict";
import {normalizeLaunchTrialAdminInput} from "../app/launchTrialAdminModel";

test("admin trial model validates dates and quota values",()=>{
  const value=normalizeLaunchTrialAdminInput({end:"bad",limits:{trial_ai_requests:-10}});
  assert.equal(value.end,"2026-09-12T16:00:00+03:00");
  assert.equal(value.limits.trial_ai_requests,20);
});
