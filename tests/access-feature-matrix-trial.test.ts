import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("trial exposes every matrix feature while marking heavy/project access limited",()=>{for(const row of ACCESS_FEATURE_MATRIX)assert.notEqual(row.trial,false);for(const row of ACCESS_FEATURE_MATRIX.filter(x=>["التلخيص","ميزات الذكاء","NAVIXA English Learning","NAVIXA Kids","NAVIXA Fitness"].includes(x.feature)))assert.equal(row.trial,"limited");});
