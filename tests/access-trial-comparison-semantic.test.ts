import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("comparison uses semantic table headings",()=>{const source=fs.readFileSync("app/AccessComparison.tsx","utf8");assert.match(source,/<table/);assert.match(source,/<thead>/);assert.match(source,/<tbody>/);assert.match(source,/<th>الميزة<\/th>/);});
