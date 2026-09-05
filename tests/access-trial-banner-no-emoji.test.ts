import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder avoids decorative emoji",()=>{const source=fs.readFileSync("app/launchTrialCopy.ts","utf8");assert.doesNotMatch(source,/🎁|✨|🚀|🔥/);});
