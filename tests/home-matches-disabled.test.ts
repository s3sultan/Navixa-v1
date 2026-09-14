import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("homepage keeps matches fully out of the startup runtime", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  for (const marker of [
    "./matches.css",
    "/api/matches",
    "/api/match-display",
    "/api/match-events",
    "MATCH_COMPETITIONS",
    "matchAlerts",
    "matchPersonal",
    "manualMatches",
    "selectedMatch",
    "matches-ribbon",
    "matches-tool",
    "setModal(\"matches\")",
    "modal===\"matches\"",
  ]) assert.equal(page.includes(marker), false, `homepage still contains ${marker}`);
});

test("matches backend remains available for a reversible future return", async () => {
  const route = await readFile(new URL("app/api/matches/route.ts", root), "utf8");
  assert.match(route, /export async function GET|export function GET/);
});
