import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("Azm excludes heavy services while trial is limited full access",()=>{const summary=ACCESS_FEATURE_MATRIX.find(x=>x.feature==="التلخيص")!;assert.equal(summary.azm,false);assert.equal(summary.trial,"limited");assert.equal(summary.himma,true);});
