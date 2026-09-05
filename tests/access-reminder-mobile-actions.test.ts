import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder plan actions remain usable on mobile",()=>{const css=fs.readFileSync("app/launch-trial.css","utf8");assert.match(css,/@media\(max-width:650px\)[\s\S]*launch-trial-actions\{width:100%\}/);assert.match(css,/launch-trial-actions a\{flex:1/);});
