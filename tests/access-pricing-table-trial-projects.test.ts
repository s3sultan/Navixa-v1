import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("comparison table marks trial project access limited",()=>{for(const feature of ["NAVIXA English Learning","NAVIXA Kids","NAVIXA Fitness"]){const row=ACCESS_FEATURE_MATRIX.find(x=>x.feature===feature)!;assert.equal(row.trial,"limited");}});
