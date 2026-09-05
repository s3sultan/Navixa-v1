import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("reminder visually prioritizes first Himma action",()=>{const css=fs.readFileSync("app/launch-trial.css","utf8");assert.match(css,/launch-trial-actions a:first-child\{background:#ea580c;color:#fff/);});
