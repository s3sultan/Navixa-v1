import test from "node:test";
import assert from "node:assert/strict";
import {planAccessSummary} from "../app/planAccess";
test("plan summaries switch cleanly after trial cutoff",()=>{const before=new Date("2026-09-12T15:59:59+03:00"),after=new Date("2026-09-12T16:00:00+03:00");assert.equal(planAccessSummary("free",before),"trial-full-limited");assert.equal(planAccessSummary("free",after),"free");assert.equal(planAccessSummary("azm",after),"monitoring-and-name-call");assert.equal(planAccessSummary("himma",after),"full");});
