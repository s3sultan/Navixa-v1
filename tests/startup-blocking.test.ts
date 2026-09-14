import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("root startup does not mount the decorative splash", async () => {
  const [layout, splash] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/NavixaSplash.tsx", root), "utf8"),
  ]);
  assert.doesNotMatch(layout, /NavixaSplash/);
  assert.match(splash, /900/);
});

test("Alexandria stylesheet is loaded once without a nested CSS import", async () => {
  const [layout, navixa] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/navixa.css", root), "utf8"),
  ]);
  assert.match(layout, /fonts\.googleapis\.com\/css2\?family=Alexandria/);
  assert.doesNotMatch(navixa, /fonts\.googleapis\.com/);
});
