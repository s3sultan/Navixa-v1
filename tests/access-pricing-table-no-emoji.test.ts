import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("comparison avoids decorative emoji in plan matrix",()=>{const source=fs.readFileSync("app/AccessComparison.tsx","utf8");assert.doesNotMatch(source,/🎁|✨|🚀|🔥/);});
