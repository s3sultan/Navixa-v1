import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("new public launch UI uses Himma and Azm names",()=>{for(const file of ["app/pricing/page.tsx","app/LaunchTrialNotice.tsx","app/accessModel.ts"]){const source=fs.readFileSync(file,"utf8");assert.doesNotMatch(source,/>Plus</);assert.doesNotMatch(source,/>Sprint</);}});
