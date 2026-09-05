import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder uses neutral Saudi-time wording without regional persona",()=>{const source=fs.readFileSync("app/launchTrialCopy.ts","utf8");assert.match(source,/بتوقيت السعودية/);assert.doesNotMatch(source,/خليجي|سعوديّة|لهجة/);});
