import test from "node:test";
import assert from "node:assert/strict";
import {isCapabilityAllowed} from "../app/planAccessPolicy";
test("Azm post-trial scope is exactly screen monitoring and name call among paid capabilities",()=>{const caps=["screen-monitoring","name-call","summarization","ai","english-learning","kids","fitness"] as const;const allowed=caps.filter(cap=>isCapabilityAllowed({plan:"azm",trialActive:false},cap));assert.deepEqual(allowed,["screen-monitoring","name-call"]);});
