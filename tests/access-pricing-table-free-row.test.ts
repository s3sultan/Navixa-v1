import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("free basics row is included for all tiers",()=>{assert.deepEqual(ACCESS_FEATURE_MATRIX[0],{feature:"المزايا المجانية",free:true,trial:true,azm:true,himma:true});});
