import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("trial reminder status makes no third-party network calls",()=>{for(const file of ["app/LaunchTrialNotice.tsx","app/TrialAccessBootstrap.tsx"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/https?:\/\//);assert.match(source,/\/api\/access\/trial/);}});
