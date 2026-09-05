import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("comparison table reserves projects for Himma after trial",()=>{for(const feature of ["NAVIXA English Learning","NAVIXA Kids","NAVIXA Fitness"]){const row=ACCESS_FEATURE_MATRIX.find(x=>x.feature===feature)!;assert.equal(row.azm,false);assert.equal(row.himma,true);}});
