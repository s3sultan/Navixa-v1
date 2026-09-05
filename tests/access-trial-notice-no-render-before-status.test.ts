import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("reminder stays hidden until authoritative status says reminder",()=>{const source=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");assert.match(source,/if\(status\?\.phase!=="reminder"\)return null/);});
