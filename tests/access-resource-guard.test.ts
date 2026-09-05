import test from "node:test";
import assert from "node:assert/strict";
import {resourceGuard} from "../app/accessResourceGuard";
test("resource guard blocks Azm heavy work and caps trial usage",()=>{assert.equal(resourceGuard("azm",false,"summarization",0).allowed,false);assert.equal(resourceGuard("free",true,"summarization",0).allowed,true);assert.equal(resourceGuard("free",true,"summarization",30).allowed,false);assert.equal(resourceGuard("free",true,"summarization",Number.NaN).allowed,false);});
