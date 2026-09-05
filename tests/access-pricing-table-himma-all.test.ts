import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("Himma comparison column is fully included",()=>{assert.ok(ACCESS_FEATURE_MATRIX.every(x=>x.himma===true));});
