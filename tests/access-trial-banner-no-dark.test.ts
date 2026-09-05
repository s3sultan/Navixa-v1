import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder avoids a dark panel treatment",()=>{const css=fs.readFileSync("app/launch-trial.css","utf8");assert.doesNotMatch(css,/background:#0[0-9a-f]{5}|background:#1[0-9a-f]{5}/i);});
