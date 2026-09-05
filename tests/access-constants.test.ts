import test from "node:test";
import assert from "node:assert/strict";
import {ACCESS_CAPABILITIES,ACCESS_PLANS} from "../app/accessConstants";
test("canonical access constants include approved plans and capabilities",()=>{assert.deepEqual(ACCESS_PLANS,["free","azm","himma"]);assert.ok(ACCESS_CAPABILITIES.includes("summarization"));assert.ok(ACCESS_CAPABILITIES.includes("screen-monitoring"));});
