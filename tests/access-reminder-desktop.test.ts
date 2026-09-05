import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("desktop launch reminder stays visible at top without modal overlay",()=>{const css=fs.readFileSync("app/launch-trial.css","utf8");assert.match(css,/position:sticky;top:0/);assert.doesNotMatch(css,/position:fixed/);});
