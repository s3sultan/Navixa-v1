import test from "node:test";
import assert from "node:assert/strict";
import {usageLimitFor} from "../app/accessUsagePolicy";
test("Azm heavy-service limits are zero after trial",()=>{assert.equal(usageLimitFor("azm",false,"summarization"),0);assert.equal(usageLimitFor("azm",false,"ai"),0);});
