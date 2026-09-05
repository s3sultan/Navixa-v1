import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder explicitly renders RTL Arabic",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/dir="rtl"/);});
