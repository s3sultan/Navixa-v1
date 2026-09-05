import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("Azm fallback keeps five-day period label",()=>{const source=fs.readFileSync("app/pricing/page.tsx","utf8");assert.match(source,/name:"عَزْم",days:5,periodLabel:"خمسة أيام"/);});
