import test from "node:test";
import assert from "node:assert/strict";
import {normalizeLaunchTrialAdminInput} from "../app/launchTrialAdminModel";
test("empty admin input falls back to approved launch configuration",()=>{const value=normalizeLaunchTrialAdminInput({});assert.equal(value.start,"2026-09-05T00:00:00+03:00");assert.equal(value.reminderStart,"2026-09-09T00:00:00+03:00");assert.equal(value.end,"2026-09-12T16:00:00+03:00");});
