import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("screen monitoring and name call are the two Azm paid capabilities",()=>{const rows=ACCESS_FEATURE_MATRIX.filter(x=>x.azm===true&&x.free===false).map(x=>x.feature);assert.deepEqual(rows,["مراقبة الشاشة","نداء الاسم"]);});
