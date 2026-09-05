import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("free plan excludes paid capabilities after trial",()=>{for(const row of ACCESS_FEATURE_MATRIX.filter(x=>x.feature!=="المزايا المجانية"))assert.equal(row.free,false);});
