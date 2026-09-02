import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const path of [
  "../app/api/admin/assistant-learning/route.ts",
  "../app/api/admin/meeting-settings/route.ts",
]) {
  test(`admin GET uses session auth while mutations retain same-origin: ${path}`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /mutation\s*=\s*false/);
    assert.match(source, /mutation\s*&&\s*!isTrustedSameOriginRequest\(request\)/);
    assert.match(source, /allowed\(request,true\)/);
  });
}
