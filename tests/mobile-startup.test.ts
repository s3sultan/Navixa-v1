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

test("homepage lazy-loads tutorial and overview video modals", async () => {
  const [page, videoModal] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/home-performance/HomeVideoModal.tsx", root), "utf8"),
  ]);
  assert.match(page, /dynamic\(\(\) => import\("\.\/home-performance\/HomeVideoModal"\)/);
  assert.match(page, /\(overviewVideoOpen\|\|tutorialOpen\)&&<HomeVideoModal/);
  assert.doesNotMatch(page, /navixa-overview-video-backdrop/);
  assert.doesNotMatch(page, /tutorial-modal-back/);
  assert.match(videoModal, /navixa-overview-video-backdrop/);
  assert.match(videoModal, /tutorial-modal-back/);
  assert.match(videoModal, /preload="none"/);
});

test("direct-entry hides welcome before hydration and persists the real preference key", async () => {
  const [directEntry, directEntryStyles, layout] = await Promise.all([
    readFile(new URL("app/DirectEntry.tsx", root), "utf8"),
    readFile(new URL("app/direct-entry.css", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);
  assert.match(directEntryStyles, /\.welcome,\s*\n\.welcome-screen,\s*\n\.welcome-overlay,\s*\n\.welcome-gate\s*\{/);
  assert.doesNotMatch(directEntryStyles, /data-navixa-direct-entry=\"true\"\]\s+\.welcome-screen/);
  assert.match(directEntryStyles, /html\[data-navixa-direct-entry=\"true\"\]\s+\.entry-gate/);
  assert.match(layout, /import "\.\/direct-entry\.css";/);
  assert.match(directEntry, /localStorage\.setItem\("navixa-hide-welcome", "1"\)/);
  assert.match(directEntry, /document\.documentElement\.dataset\.navixaDirectEntry = "true"/);
  assert.doesNotMatch(directEntry, /<style>/);
});