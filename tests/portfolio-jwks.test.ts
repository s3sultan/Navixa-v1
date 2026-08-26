import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PORTFOLIO_JWKS } from "../worker/portfolioAccess.ts";

test("JWKS المنظومة ينشر مفتاح تحقق ES256 فقط", () => {
  assert.equal(PORTFOLIO_JWKS.keys.length, 1);
  const [key] = PORTFOLIO_JWKS.keys;
  assert.equal(key.kty, "EC");
  assert.equal(key.crv, "P-256");
  assert.equal(key.alg, "ES256");
  assert.equal(key.use, "sig");
  assert.equal(key.key_ops[0], "verify");
  assert.equal("d" in key, false);
});

test("Worker يعرض JWKS العام بمسار منفصل وذاكرة مضبوطة", () => {
  const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /\/api\/portfolio\/jwks\.json/);
  assert.match(worker, /application\/jwk-set\+json/);
  assert.match(worker, /max-age=300/);
});
