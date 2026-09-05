import test from "node:test";
import assert from "node:assert/strict";
import {usageLimitFor} from "../app/accessUsagePolicy";
test("Himma retains positive heavy-service quotas after trial",()=>{assert.ok(usageLimitFor("himma",false,"summarization")>0);assert.ok(usageLimitFor("himma",false,"ai")>0);});
