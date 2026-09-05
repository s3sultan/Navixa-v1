import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial schedule has no payment provider coupling",()=>{const source=fs.readFileSync("app/launchTrial.ts","utf8");assert.doesNotMatch(source,/moyasar|payment|checkout/i);});
