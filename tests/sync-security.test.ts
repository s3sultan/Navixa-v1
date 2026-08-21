import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/sync/route.ts";

const syncId = "a".repeat(32);
const syncKey = "b".repeat(48);

test("secure sync rejects cross-origin writes before touching storage", async () => {
  const response = await POST(new Request("https://navixa.example/api/sync", {
    method: "POST",
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    body: JSON.stringify({ syncId, syncKey, payload: "{}" }),
  }));
  assert.equal(response.status, 403);
});

test("secure sync reads require an independent sync key", async () => {
  const response = await GET(new Request(`https://navixa.example/api/sync?syncId=${syncId}`, {
    headers: { origin: "https://navixa.example" },
  }));
  assert.equal(response.status, 400);
});
