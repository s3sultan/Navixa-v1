import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("comparison starts with basics then core monitoring features",()=>{assert.deepEqual(ACCESS_FEATURE_MATRIX.slice(0,3).map(x=>x.feature),["المزايا المجانية","مراقبة الشاشة","نداء الاسم"]);});
