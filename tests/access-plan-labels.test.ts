import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_PLAN_LABELS} from "../app/accessPlanLabels";
test("public plan labels use approved Arabic branding",()=>{assert.equal(ACCESS_PLAN_LABELS.azm,"عَزْم");assert.equal(ACCESS_PLAN_LABELS.himma,"هِمّة");});
