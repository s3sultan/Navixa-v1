import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("Azm comparison has exactly two non-free inclusions",()=>{assert.equal(ACCESS_FEATURE_MATRIX.filter(x=>x.azm===true&&x.free===false).length,2);});
