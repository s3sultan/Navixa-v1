import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("global reminder says trial ends automatically",()=>{const source=fs.readFileSync("app/launchTrialCopy.ts","utf8");assert.match(source,/تنتهي تلقائيًا/);});
