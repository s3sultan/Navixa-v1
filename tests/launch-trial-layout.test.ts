import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch trial global components are mounted without removing pricing shortcut",()=>{const source=fs.readFileSync("app/layout.tsx","utf8");assert.match(source,/TrialAccessBootstrap/);assert.match(source,/LaunchTrialNotice/);assert.match(source,/PricingHeaderShortcut/);assert.match(source,/launch-trial\.css/);});
