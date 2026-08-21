import assert from "node:assert/strict";
import test from "node:test";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  },
});

const originalFetch = globalThis.fetch;
let submitted: unknown = null;
globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
  submitted = init?.body ? JSON.parse(String(init.body)) : null;
  return new Response("{}", { status: 200 });
}) as typeof fetch;

const { purgeLegacyTelegramConfig, sendTelegramMessage } = await import("../app/alertPrefs.ts");

test("legacy Telegram credentials are deleted and the browser sends only the alert payload", async () => {
  values.clear();
  values.set("navixa-telegram-config", JSON.stringify({ token: "123:legacy-token", chatId: "100" }));
  purgeLegacyTelegramConfig();
  assert.equal(values.has("navixa-telegram-config"), false);

  const sent = await sendTelegramMessage("تنبيه اختبار", "water");
  assert.equal(sent, true);
  assert.deepEqual(submitted, { message: "تنبيه اختبار", type: "water" });
});

test.after(() => { globalThis.fetch = originalFetch; });
