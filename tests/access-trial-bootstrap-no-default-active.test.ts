import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("bootstrap does not default trial active before server response",()=>{const source=fs.readFileSync("app/TrialAccessBootstrap.tsx","utf8");assert.doesNotMatch(source,/navixaTrial\s*=\s*["']active["']/);});
