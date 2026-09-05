import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder includes a human-readable remaining time",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/remainingLabel\(status\.remainingMs\)/);assert.match(source,/يوم و/);assert.match(source,/ساعة و/);assert.match(source,/دقيقة/);});
