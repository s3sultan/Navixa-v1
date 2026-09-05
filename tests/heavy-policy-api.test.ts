import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("heavy policy uses server clock and plan quota mapping",()=>{const source=fs.readFileSync("app/api/access/heavy-policy/route.ts","utf8");assert.match(source,/launchTrialPhase\(new Date\(\)\)/);assert.match(source,/usageLimitFor/);assert.match(source,/allowed:limit>0/);assert.match(source,/Cache-Control":"no-store/);});
