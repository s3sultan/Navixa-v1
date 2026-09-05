import test from "node:test";
import assert from "node:assert/strict";
import {accessDecisionAudit} from "../app/accessAudit";
test("access audit contains no user PII by design",()=>{const audit=accessDecisionAudit("azm","summarization",false,false,new Date("2026-09-12T13:00:00Z"));assert.deepEqual(Object.keys(audit),["plan","capability","allowed","trialActive","at"]);});
