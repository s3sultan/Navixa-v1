import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial cutoff logic does not depend on browser locale formatting",()=>{const source=fs.readFileSync("app/launchTrial.ts","utf8");assert.doesNotMatch(source,/toLocaleString|Intl\.DateTimeFormat/);assert.match(source,/Date\.parse/);});
