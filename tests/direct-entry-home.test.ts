import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("public trial bypasses the welcome screen at render time", () => {
  assert.match(page, /const DIRECT_ENTRY=true/);
  assert.match(page, /DIRECT_ENTRY\|\|entered\|\|hideWelcomeForever/);
  assert.match(page, /!DIRECT_ENTRY&&welcomePreferenceReady&&!entered&&!hideWelcomeForever/);
});
