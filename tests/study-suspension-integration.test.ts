import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pushRoute = await readFile(new URL("../app/api/push/subscriptions/route.ts", import.meta.url), "utf8");
const testRoute = await readFile(new URL("../app/api/admin/study-suspension/test/route.ts", import.meta.url), "utf8");
const pollRoute = await readFile(new URL("../app/api/admin/study-suspension/poll/route.ts", import.meta.url), "utf8");
const pollWorker = await readFile(new URL("../worker/studySuspensionPoll.ts", import.meta.url), "utf8");
const workerIndex = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const store = await readFile(new URL("../worker/studySuspensionStore.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/0048_study_suspension_alerts.sql", import.meta.url), "utf8");

test("signed-in Push subscriptions are bound to the NAVIXA user id", () => {
  assert.match(pushRoute, /resolveUserSession/);
  assert.match(pushRoute, /user_id/);
  assert.match(pushRoute, /accountBound/);
});

test("manual study suspension test requires both admin and NAVIXA sessions for the same email", () => {
  assert.match(testRoute, /verifyAdminSessionToken/);
  assert.match(testRoute, /resolveUserSession/);
  assert.match(testRoute, /admin\.email\.trim\(\)\.toLowerCase\(\) !== user\.email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(testRoute, /mode: "test"/);
  assert.match(testRoute, /هذا لا يمثل قرار تعليق دراسة حقيقيًا/);
});

test("official X poll stays owner-only and test-only", () => {
  assert.match(pollRoute, /X_API_BEARER_TOKEN/);
  assert.match(pollRoute, /verifyAdminSessionToken/);
  assert.match(pollRoute, /resolveUserSession/);
  assert.match(pollRoute, /mode: "test"/);
  assert.doesNotMatch(pollRoute, /mode: "live"/);
});

test("scheduled polling runs every existing cron tick but sends only to D1 test recipients", () => {
  assert.match(workerIndex, /pollStudySuspensionTestRecipients/);
  assert.match(pollWorker, /navixa_study_suspension_test_recipients WHERE enabled=1/);
  assert.match(pollWorker, /if \(!testRecipientIds\.length\)/);
  assert.match(pollWorker, /mode: "test"/);
  assert.doesNotMatch(pollWorker, /mode: "live"/);
});

test("D1 ledger and source registry are persistent and seed the official Riyadh source", () => {
  assert.match(store, /navixa_study_suspension_delivery/);
  assert.match(store, /INSERT OR IGNORE INTO navixa_study_suspension_delivery/);
  assert.match(store, /MOE_RYH/);
  assert.match(migration, /navixa_study_suspension_sources/);
  assert.match(migration, /education-admin:riyadh/);
  assert.match(migration, /MOE_RYH/);
});
