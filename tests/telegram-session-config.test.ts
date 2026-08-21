import assert from "node:assert/strict";
import test from "node:test";
import { clearTelegramConfig, getTelegramConfig, setTelegramConfig } from "../app/alertPrefs.ts";

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

test("Telegram credentials stay in memory and legacy local storage is purged", () => {
  values.clear();
  values.set("navixa-telegram-config", JSON.stringify({ token: "123:legacy-token", chatId: "100" }));

  assert.equal(getTelegramConfig(), null);
  assert.equal(values.has("navixa-telegram-config"), false);

  setTelegramConfig({ token: "123:session-token", chatId: "200" });
  assert.deepEqual(getTelegramConfig(), { token: "123:session-token", chatId: "200" });
  assert.equal(values.has("navixa-telegram-config"), false);

  clearTelegramConfig();
  assert.equal(getTelegramConfig(), null);
});
