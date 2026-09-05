import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("heavy AI capabilities are grouped before affiliated projects",()=>{assert.deepEqual(ACCESS_FEATURE_MATRIX.slice(3,5).map(x=>x.feature),["التلخيص","ميزات الذكاء"]);});
