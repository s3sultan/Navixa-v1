import test from "node:test";
import assert from "node:assert/strict";
import {normalizeLaunchTrialAdminInput} from "../app/launchTrialAdminModel";
test("admin quota normalization clamps excessive values",()=>{const value=normalizeLaunchTrialAdminInput({limits:{trial_ai_requests:9999999}});assert.equal(value.limits.trial_ai_requests,100000);});
