import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
test("access API documentation forbids client trust for paid access",()=>{const source=fs.readFileSync("app/api/access/README.md","utf8");assert.match(source,/authenticated user's plan/);assert.match(source,/never a client-provided `used` value/);});
