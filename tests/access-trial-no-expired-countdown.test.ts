import test from "node:test";
import assert from "node:assert/strict";
import {launchTrialRemainingMs} from "../app/launchTrial";
test("expired trial countdown clamps to zero",()=>{assert.equal(launchTrialRemainingMs(new Date("2030-01-01T00:00:00+03:00")),0);});
