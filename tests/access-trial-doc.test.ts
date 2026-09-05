import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("approved access model is documented with exact launch cutoff",()=>{const source=fs.readFileSync("docs/plan-access-model.md","utf8");assert.match(source,/2026-09-12 16:00 Asia\/Riyadh/);assert.match(source,/عَزْم/);assert.match(source,/هِمّة/);});
