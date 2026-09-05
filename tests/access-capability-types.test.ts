import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("capability type includes monitoring heavy AI and affiliated projects",()=>{const source=fs.readFileSync("app/planAccess.ts","utf8");for(const cap of ["screen-monitoring","name-call","summarization","ai","english-learning","kids","fitness"])assert.match(source,new RegExp(cap));});
