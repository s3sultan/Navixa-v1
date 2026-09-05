import test from "node:test";
import assert from "node:assert/strict";
import {hasPlanCapability,planAccessSummary} from "../app/planAccess";

const duringTrial=new Date("2026-09-10T12:00:00+03:00");
const afterTrial=new Date("2026-09-12T16:00:01+03:00");

test("trial temporarily opens all capabilities",()=>{
  assert.equal(hasPlanCapability("free","summarization",duringTrial),true);
  assert.equal(planAccessSummary("free",duringTrial),"trial-full-limited");
});

test("Azm only adds monitoring and name-call after trial",()=>{
  assert.equal(hasPlanCapability("azm","screen-monitoring",afterTrial),true);
  assert.equal(hasPlanCapability("azm","name-call",afterTrial),true);
  assert.equal(hasPlanCapability("azm","summarization",afterTrial),false);
  assert.equal(hasPlanCapability("azm","ai",afterTrial),false);
  assert.equal(hasPlanCapability("azm","english-learning",afterTrial),false);
});

test("Himma keeps full capabilities after trial",()=>{
  assert.equal(hasPlanCapability("himma","summarization",afterTrial),true);
  assert.equal(hasPlanCapability("himma","kids",afterTrial),true);
  assert.equal(planAccessSummary("himma",afterTrial),"full");
});
