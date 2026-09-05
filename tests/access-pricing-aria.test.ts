import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("pricing plan links remain accessible",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/aria-label=\{`عرض سعر ومميزات \$\{plan\.name\}`\}/);});
