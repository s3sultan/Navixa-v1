import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder is responsive and accessible",()=>{const css=fs.readFileSync("app/launch-trial.css","utf8");const notice=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(css,/@media\(max-width:650px\)/);assert.match(notice,/role="status"/);assert.match(notice,/aria-live="polite"/);});
