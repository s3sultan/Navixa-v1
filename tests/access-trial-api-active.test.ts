import test from "node:test";
import assert from "node:assert/strict";
import {getLaunchTrialStatus} from "../app/launchTrialServer";
test("server status marks trial and reminder active only",()=>{assert.equal(getLaunchTrialStatus(new Date("2026-09-06T12:00:00+03:00")).active,true);assert.equal(getLaunchTrialStatus(new Date("2026-09-10T12:00:00+03:00")).active,true);assert.equal(getLaunchTrialStatus(new Date("2026-09-13T12:00:00+03:00")).active,false);});
