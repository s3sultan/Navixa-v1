import assert from "node:assert/strict";
import test from "node:test";
import { decryptTelegramIdentifier, encryptTelegramIdentifier, hashTelegramValue, validTelegramLinkToken } from "../worker/telegramBot.ts";

const secret = "test-telegram-encryption-key-with-sufficient-length";

test("official Telegram links encrypt the destination and hash the Telegram identity", async () => {
  const chatId = "123456789";
  const ciphertext = await encryptTelegramIdentifier(chatId, secret);
  assert.notEqual(ciphertext, chatId);
  assert.equal(ciphertext.includes(chatId), false);
  assert.equal(await decryptTelegramIdentifier(ciphertext, secret), chatId);
  assert.notEqual(await hashTelegramValue("111", secret), await hashTelegramValue("222", secret));
});

test("official Telegram link token format rejects short and malformed values", () => {
  assert.equal(validTelegramLinkToken("a".repeat(32)), true);
  assert.equal(validTelegramLinkToken("short-token"), false);
  assert.equal(validTelegramLinkToken("a".repeat(65)), false);
  assert.equal(validTelegramLinkToken("a".repeat(31) + "+"), false);
});
