import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing comparison has mobile-safe table styling",()=>{const css=fs.readFileSync("app/public-pricing.css","utf8");const component=fs.readFileSync("app/AccessComparison.tsx","utf8");assert.match(component,/overflowX:"auto"/);assert.match(component,/minWidth:620/);assert.match(css,/public-pricing table/);assert.match(css,/@media\(max-width:700px\)/);});
