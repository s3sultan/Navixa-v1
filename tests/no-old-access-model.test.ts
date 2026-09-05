import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("current pricing never advertises summarization as Azm",()=>{const pricing=fs.readFileSync("app/pricing/page.tsx","utf8");const matrix=fs.readFileSync("app/accessFeatureMatrix.ts","utf8");assert.doesNotMatch(pricing,/عَزْم[^\n]{0,160}تلخيص/);assert.match(matrix,/feature:"التلخيص",free:false,trial:"limited",azm:false,himma:true/);});
