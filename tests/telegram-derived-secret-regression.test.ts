import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const telegramBot = readFileSync(new URL("../worker/telegramBot.ts", import.meta.url), "utf8");

test("Telegram webhook derivation preserves exact deployed secret bytes", () => {
  assert.match(telegramBot, /const rootSecretRaw = runtime\.ADMIN_JWT_SECRET \|\| ""/);
  assert.match(telegramBot, /deriveTelegramSecret\(rootSecretRaw, "webhook"\)/);
  assert.match(telegramBot, /const rootSecret = rootSecretRaw\.trim\(\)/);
  assert.match(telegramBot, /deriveTelegramSecret\(rootSecret, "encryption"\)/);
});
