import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("base free features remain available in every tier",()=>{const row=ACCESS_FEATURE_MATRIX.find(x=>x.feature==="المزايا المجانية")!;assert.equal(row.free,true);assert.equal(row.trial,true);assert.equal(row.azm,true);assert.equal(row.himma,true);});
