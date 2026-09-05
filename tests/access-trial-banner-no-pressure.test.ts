import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("launch reminder avoids high-pressure sales language",()=>{const source=fs.readFileSync("app/launchTrialCopy.ts","utf8");assert.doesNotMatch(source,/اشترك الآن|لا تفوت|آخر فرصة|سارع|فورًا/);});
