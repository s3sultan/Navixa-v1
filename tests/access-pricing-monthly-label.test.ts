import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("Himma fallback keeps one-month period label",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/name:"هِمّة",days:30,periodLabel:"شهر واحد"/);});
