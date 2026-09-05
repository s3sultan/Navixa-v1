import test from "node:test";
import assert from "node:assert/strict";
import {enforceCapability} from "../app/accessEnforcement";
test("server enforcement expires trial and protects heavy services from Azm",()=>{assert.equal(enforceCapability("free","summarization",new Date("2026-09-10T12:00:00+03:00")).allowed,true);assert.equal(enforceCapability("azm","summarization",new Date("2026-09-12T16:00:01+03:00")).allowed,false);assert.equal(enforceCapability("azm","name-call",new Date("2026-09-12T16:00:01+03:00")).allowed,true);});
