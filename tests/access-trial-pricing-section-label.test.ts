import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing section is labelled for assistive tech",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/aria-labelledby="pricing-title"/);});
