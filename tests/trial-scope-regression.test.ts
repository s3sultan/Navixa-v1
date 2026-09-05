import test from "node:test";
import assert from "node:assert/strict";
import {isCapabilityAllowed} from "../app/planAccessPolicy";
test("launch trial opens every defined paid capability regardless of base plan",()=>{for(const cap of ["screen-monitoring","name-call","summarization","ai","english-learning","kids","fitness"] as const)assert.equal(isCapabilityAllowed({plan:"free",trialActive:true},cap),true);});
