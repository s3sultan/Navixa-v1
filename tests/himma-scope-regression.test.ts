import test from "node:test";
import assert from "node:assert/strict";
import {isCapabilityAllowed} from "../app/planAccessPolicy";
test("Himma keeps every defined paid capability after trial",()=>{for(const cap of ["screen-monitoring","name-call","summarization","ai","english-learning","kids","fitness"] as const)assert.equal(isCapabilityAllowed({plan:"himma",trialActive:false},cap),true);});
