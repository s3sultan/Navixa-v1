import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("public trial status endpoint exposes no user data",()=>{const source=fs.readFileSync("app/launchTrialServer.ts","utf8");assert.doesNotMatch(source,/email|name|userId|phone|account/i);});
