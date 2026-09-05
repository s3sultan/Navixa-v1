import test from "node:test";
import assert from "node:assert/strict";
import {NAVIXA_ACCESS_MODEL} from "../app/accessModel";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("public model and feature matrix agree on Azm and Himma",()=>{assert.match(NAVIXA_ACCESS_MODEL.azm.description,/مراقبة الشاشة/);for(const row of ACCESS_FEATURE_MATRIX.filter(r=>["التلخيص","ميزات الذكاء","NAVIXA Kids","NAVIXA Fitness","NAVIXA English Learning"].includes(r.feature))){assert.equal(row.azm,false);assert.equal(row.himma,true);}});
