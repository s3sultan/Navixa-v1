import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access model documentation records resource protection intent",()=>{const source=fs.readFileSync("docs/plan-access-model.md","utf8");assert.match(source,/Heavy services must remain quota-controlled/);assert.match(source,/AI\/transcription\/summarization capacity/);});
