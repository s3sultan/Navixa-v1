import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing cards remain single-column on mobile",()=>{const css=fs.readFileSync("app/public-pricing.css","utf8");assert.match(css,/@media\(max-width:700px\)[\s\S]*public-pricing-grid\{grid-template-columns:1fr/);});
