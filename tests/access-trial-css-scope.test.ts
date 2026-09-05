import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder CSS is scoped to launch classes",()=>{const css=fs.readFileSync("app/launch-trial.css","utf8");assert.match(css,/\.launch-trial-notice/);assert.doesNotMatch(css,/(^|\})\s*(body|html|a|button)\s*\{/);});
