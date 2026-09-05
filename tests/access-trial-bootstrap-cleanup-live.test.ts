import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial bootstrap ignores late responses after unmount",()=>{const source=fs.readFileSync("app/TrialAccessBootstrap.tsx","utf8");assert.match(source,/let live=true/);assert.match(source,/if\(!live\|\|!data\)return/);assert.match(source,/live=false/);});
