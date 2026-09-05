import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("global trial state refreshes every 30 seconds",()=>{const source=fs.readFileSync("app/TrialAccessBootstrap.tsx","utf8");assert.match(source,/setInterval\(sync,30000\)/);});
