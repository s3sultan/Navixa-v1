import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder offers plan links without forced navigation",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.doesNotMatch(source,/window\.location|router\.push|redirect/);assert.match(source,/<Link href="\/plus"/);});
