import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder uses a light background",()=>{const css=fs.readFileSync("app/launch-trial.css","utf8");assert.match(css,/background:#fff7ed/);});
