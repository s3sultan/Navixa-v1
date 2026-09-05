import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing public copy uses Himma and Azm",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/هِمّة/);assert.match(source,/عَزْم/);});
