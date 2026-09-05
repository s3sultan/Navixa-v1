import test from "node:test";
import assert from "node:assert/strict";
import {usageLimitFor} from "../app/accessUsagePolicy";
test("Himma heavy-service capacity is materially above launch trial",()=>{assert.ok(usageLimitFor("himma",false,"summarization")>=usageLimitFor("free",true,"summarization")*10);assert.ok(usageLimitFor("himma",false,"ai")>=usageLimitFor("free",true,"ai")*10);});
