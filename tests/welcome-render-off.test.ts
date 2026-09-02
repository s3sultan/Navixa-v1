import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const directEntry = await readFile(new URL("../app/DirectEntry.tsx", import.meta.url), "utf8");

test("welcome screen is hidden unconditionally during direct public entry", () => {
  assert.match(directEntry, /\.welcome,\s*\n\s*\.welcome-screen,/);
  assert.doesNotMatch(directEntry, /data-navixa-direct-entry=\"true\"\]\s+\.welcome,/);
});
