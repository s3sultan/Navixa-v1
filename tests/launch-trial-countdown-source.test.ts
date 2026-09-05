import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("visible countdown uses server-provided remaining time",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/status\.remainingMs/);assert.match(source,/\/api\/access\/trial/);});
