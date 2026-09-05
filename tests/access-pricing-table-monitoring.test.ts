import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("comparison table gives Azm monitoring and name call",()=>{for(const feature of ["مراقبة الشاشة","نداء الاسم"]){const row=ACCESS_FEATURE_MATRIX.find(x=>x.feature===feature)!;assert.equal(row.azm,true);assert.equal(row.himma,true);}});
