import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("comparison covers the current eight key access categories",()=>{assert.equal(ACCESS_FEATURE_MATRIX.length,8);});
