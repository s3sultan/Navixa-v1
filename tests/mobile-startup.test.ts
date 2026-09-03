import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
test("homepage defers non-essential mobile startup tools", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /dynamic\(\(\) => import\("\.\/FloatingAssistant"\)/);
  assert.match(page, /backgroundToolsReady&&<PersonalReminderEngine/);
  assert.match(page, /requestIdleCallback/);
  assert.doesNotMatch(page, /import FloatingAssistant from/);
});

test("direct-entry hides welcome before hydration and persists the real preference key", async () => {
  const directEntry = await readFile(new URL("app/DirectEntry.tsx", root), "utf8");
  assert.match(directEntry, /\.welcome,\s*\n\s*html\[data-navixa-direct-entry=/);
  assert.match(directEntry, /localStorage\.setItem\("navixa-hide-welcome", "1"\)/);
});
