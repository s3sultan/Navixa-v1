import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder has explicit top stacking context",()=>{const css=fs.readFileSync("app/launch-trial.css","utf8");assert.match(css,/z-index:1100/);});
