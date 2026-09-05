import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("Azm matrix only adds two paid features over free",()=>{const paid=ACCESS_FEATURE_MATRIX.filter(x=>x.azm===true&&x.free===false).map(x=>x.feature);assert.deepEqual(paid,["مراقبة الشاشة","نداء الاسم"]);});
