import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const router = fs.readFileSync("worker/notifications/router.ts", "utf8");
const sms = fs.readFileSync("worker/notifications/providers/sms.ts", "utf8");
const whatsapp = fs.readFileSync("worker/notifications/providers/whatsapp.ts", "utf8");

test("notification providers remain isolated behind dynamic imports", () => {
  assert.match(router, /await import\("\.\/providers\/email"\)/);
  assert.match(router, /await import\("\.\/providers\/telegram"\)/);
  assert.match(router, /await import\("\.\/providers\/sms"\)/);
  assert.match(router, /await import\("\.\/providers\/whatsapp"\)/);
});

test("sms and whatsapp stay SDK-free", () => {
  assert.doesNotMatch(sms, /twilio|vonage|messagebird/i);
  assert.doesNotMatch(whatsapp, /from\s+["'](?:twilio|facebook|@meta)/i);
  assert.match(sms, /fetch\(endpoint/);
  assert.match(whatsapp, /fetch\(endpoint/);
});
