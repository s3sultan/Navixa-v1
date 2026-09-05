import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing launch actions remain inside NAVIXA",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.doesNotMatch(source,/href="https?:\/\//);});
