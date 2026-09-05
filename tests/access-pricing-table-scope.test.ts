import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("comparison table has no Azm heavy AI access",()=>{for(const feature of ["التلخيص","ميزات الذكاء"]){const row=ACCESS_FEATURE_MATRIX.find(x=>x.feature===feature)!;assert.equal(row.azm,false);assert.equal(row.trial,"limited");assert.equal(row.himma,true);}});
