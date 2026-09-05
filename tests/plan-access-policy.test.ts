import test from "node:test";
import assert from "node:assert/strict";
import {isCapabilityAllowed} from "../app/planAccessPolicy";

test("trusted policy preserves approved boundaries",()=>{
  assert.equal(isCapabilityAllowed({plan:"free",trialActive:true},"summarization"),true);
  assert.equal(isCapabilityAllowed({plan:"azm",trialActive:false},"screen-monitoring"),true);
  assert.equal(isCapabilityAllowed({plan:"azm",trialActive:false},"summarization"),false);
  assert.equal(isCapabilityAllowed({plan:"himma",trialActive:false},"summarization"),true);
});
