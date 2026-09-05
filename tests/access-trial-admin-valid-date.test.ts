import test from "node:test";
import assert from "node:assert/strict";
import {normalizeLaunchTrialAdminInput} from "../app/launchTrialAdminModel";
test("admin model accepts valid future cutoff override seam",()=>{const value=normalizeLaunchTrialAdminInput({end:"2026-09-13T16:00:00+03:00"});assert.equal(value.end,"2026-09-13T16:00:00+03:00");});
