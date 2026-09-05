import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder is an inline status banner not a blocking dialog",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/<aside/);assert.doesNotMatch(source,/alert\(|confirm\(|role="dialog"/);});
