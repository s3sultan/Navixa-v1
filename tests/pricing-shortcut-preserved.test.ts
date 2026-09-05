import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch update keeps persistent pricing shortcut mounted",()=>{const source=fs.readFileSync("app/layout.tsx","utf8");assert.match(source,/<PricingHeaderShortcut \/>/);});
