import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial schedule contains no per-user signup-start calculation",()=>{const source=fs.readFileSync("app/launchTrial.ts","utf8");assert.doesNotMatch(source,/createdAt|signup|registered|user/i);});
