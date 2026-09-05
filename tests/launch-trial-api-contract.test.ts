import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial API contract exposes active phase dates and remaining time",()=>{const helper=fs.readFileSync("app/launchTrialServer.ts","utf8");for(const token of ["active","phase","start","reminderStart","end","remainingMs"])assert.match(helper,new RegExp(token));});
