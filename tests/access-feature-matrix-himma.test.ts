import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_FEATURE_MATRIX} from "../app/accessFeatureMatrix";
test("Himma exposes every matrix feature",()=>{for(const row of ACCESS_FEATURE_MATRIX)assert.equal(row.himma,true);});
