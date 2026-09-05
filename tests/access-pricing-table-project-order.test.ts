import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("affiliated projects are grouped after core NAVIXA capabilities",()=>{assert.deepEqual(ACCESS_FEATURE_MATRIX.slice(-3).map(x=>x.feature),["NAVIXA English Learning","NAVIXA Kids","NAVIXA Fitness"]);});
