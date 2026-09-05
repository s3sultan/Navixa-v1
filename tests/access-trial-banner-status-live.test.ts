import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder uses polite live status semantics",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/role="status" aria-live="polite"/);});
