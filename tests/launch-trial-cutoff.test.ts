import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("launch trial uses the approved Riyadh cutoff everywhere public", async () => {
  const [gate, copy] = await Promise.all([
    readFile(new URL("app/FeatureAccessGate.tsx", root), "utf8"),
    readFile(new URL("app/content/ar.ts", root), "utf8"),
  ]);
  assert.match(gate, /2026-09-12T16:00:00\+03:00/);
  assert.doesNotMatch(gate, /2026-09-13T00:00:00\+03:00/);
  assert.match(copy, /تجربة مجانية حتى 12 سبتمبر 2026 الساعة 4:00 م/);
  assert.doesNotMatch(copy, /19 سبتمبر 2026/);
});
