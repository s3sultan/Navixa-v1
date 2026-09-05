import test from "node:test";
import assert from "node:assert/strict";
import {usageLimitFor,usageLimitKey} from "../app/accessUsagePolicy";

test("Azm gets no heavy-service quota after trial",()=>{
  assert.equal(usageLimitKey("azm",false,"summarization"),null);
  assert.equal(usageLimitFor("azm",false,"ai"),0);
});

test("trial and Himma get separate heavy-service quotas",()=>{
  assert.equal(usageLimitKey("free",true,"summarization"),"trial_summarization_minutes");
  assert.equal(usageLimitKey("himma",false,"summarization"),"himma_summarization_minutes");
  assert.ok(usageLimitFor("free",true,"summarization")<usageLimitFor("himma",false,"summarization"));
});
