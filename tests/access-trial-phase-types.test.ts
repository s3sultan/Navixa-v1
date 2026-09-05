import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial phases are a closed typed set",()=>{const source=fs.readFileSync("app/launchTrial.ts","utf8");assert.match(source,/"before" \| "trial" \| "reminder" \| "ended"/);});
