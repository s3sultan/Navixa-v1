import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/admin/telegram-bot/setup/route.ts", import.meta.url), "utf8");
const deployWorkflow = readFileSync(new URL("../.github/workflows/deploy-navixa.yml", import.meta.url), "utf8");
const telegramBot = readFileSync(new URL("../worker/telegramBot.ts", import.meta.url), "utf8");

test("official Telegram webhook setup stays admin-only and validates bot identity", () => {
  assert.match(route, /isTrustedSameOriginRequest/);
  assert.match(route, /verifyAdminSessionToken/);
  assert.match(route, /getMe/);
  assert.match(route, /setWebhook/);
  assert.match(route, /secret_token/);
  assert.match(route, /NAVIXA_TELEGRAM_BOT_TOKEN/);
  assert.doesNotMatch(route, /token:\s*token/);
});

test("production deploy restores and directly authenticates Telegram webhook on the canonical NAVIXA domain", () => {
  assert.match(deployWorkflow, /https:\/\/navixasa\.com\/api\/telegram\/webhook/);
  assert.doesNotMatch(deployWorkflow, /navixa\.s2shug\.workers\.dev\/api\/telegram\/webhook/);
  assert.match(deployWorkflow, /getWebhookInfo/);
  assert.match(deployWorkflow, /NAVIXA_TELEGRAM_WEBHOOK_SECRET/);
  assert.match(deployWorkflow, /X-Telegram-Bot-Api-Secret-Token/);
  assert.match(deployWorkflow, /Telegram webhook authenticated and verified/);
});

test("runtime webhook derivation uses the exact deployed admin-secret bytes", () => {
  assert.match(telegramBot, /const rootSecretRaw = runtime\.ADMIN_JWT_SECRET \|\| ""/);
  assert.match(telegramBot, /deriveTelegramSecret\(rootSecretRaw, "webhook"\)/);
  assert.match(telegramBot, /const rootSecret = rootSecretRaw\.trim\(\)/);
  assert.match(telegramBot, /deriveTelegramSecret\(rootSecret, "encryption"\)/);
});
