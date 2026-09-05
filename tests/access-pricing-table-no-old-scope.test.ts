import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("feature matrix contains no old Azm summary or AI entitlement",()=>{const source=fs.readFileSync("app/accessFeatureMatrix.ts","utf8");assert.match(source,/feature:"التلخيص",free:false,trial:"limited",azm:false,himma:true/);assert.match(source,/feature:"ميزات الذكاء",free:false,trial:"limited",azm:false,himma:true/);});
