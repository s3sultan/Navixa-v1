import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("trial comparison column never marks a feature unavailable",()=>{assert.ok(ACCESS_FEATURE_MATRIX.every(x=>x.trial!==false));});
