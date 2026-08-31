import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeSaudiPhone } from "../worker/notifications/phone.ts";

const adapter = await readFile(new URL("../worker/tawkedVerify.ts", import.meta.url), "utf8");

test("Tawked adapter stays REST-only and Saudi-number scoped", () => {
  assert.equal(normalizeSaudiPhone("0505383358"), "+966505383358");
  assert.equal(normalizeSaudiPhone("+966505383358"), "+966505383358");
  assert.equal(normalizeSaudiPhone("123"), "");
  assert.match(adapter, /https:\/\/tawked\.com\/v1/);
  assert.match(adapter, /\/verify\/start/);
  assert.match(adapter, /\/verify\/check/);
  assert.match(adapter, /Authorization: `Bearer \$\{apiKey\}`/);
  assert.doesNotMatch(adapter, /@tawked\/node/);
});
