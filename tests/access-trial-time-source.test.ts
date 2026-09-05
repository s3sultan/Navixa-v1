import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("server trial endpoint is the UI time source",()=>{const endpoint=fs.readFileSync("app/api/access/trial/route.ts","utf8");const notice=fs.readFileSync("app/LaunchTrialNotice.tsx","utf8");const bootstrap=fs.readFileSync("app/TrialAccessBootstrap.tsx","utf8");assert.match(endpoint,/new Date\(\)/);assert.match(notice,/\/api\/access\/trial/);assert.match(bootstrap,/\/api\/access\/trial/);});
