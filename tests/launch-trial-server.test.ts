import test from "node:test";
import assert from "node:assert/strict";
import {getLaunchTrialStatus} from "../app/launchTrialServer";

test("server trial status flips exactly at 4pm Riyadh",()=>{
  assert.equal(getLaunchTrialStatus(new Date("2026-09-12T15:59:59+03:00")).active,true);
  assert.equal(getLaunchTrialStatus(new Date("2026-09-12T16:00:00+03:00")).active,false);
  assert.equal(getLaunchTrialStatus(new Date("2026-09-12T16:00:00+03:00")).remainingMs,0);
});
