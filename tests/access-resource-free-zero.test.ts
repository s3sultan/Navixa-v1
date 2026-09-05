import test from "node:test";
import assert from "node:assert/strict";
import {usageLimitFor} from "../app/accessUsagePolicy";
test("free heavy-service limits are zero after trial",()=>{assert.equal(usageLimitFor("free",false,"summarization"),0);assert.equal(usageLimitFor("free",false,"ai"),0);});
