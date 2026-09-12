import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, route, index, academic] = await Promise.all([
  readFile(new URL("../worker/importantReminders.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/reminders/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/academicReminders.ts", import.meta.url), "utf8"),
]);
assert.match(worker, /UNIQUE\(user_id,title,due_at\)/);
assert.match(worker, /maxAttempts=3/);
assert.match(worker, /email_enabled/);
assert.match(worker, /telegram_enabled/);
assert.match(worker, /push_enabled/);
assert.match(worker, /source TEXT NOT NULL DEFAULT 'manual'/);
assert.match(worker, /navixa_user_telegram_links/);
assert.match(worker, /navixa_push_subscriptions/);
assert.match(worker, /sendFeaturePush/);
assert.match(worker, /row\.source==="schedule"/);
assert.match(worker, /navixa-schedule-/);
assert.match(route, /trustedUserMutation/);
assert.match(route, /private, no-store/);
assert.match(route, /\(!email&&!telegram&&!push\)/);
assert.match(route, /push_enabled/);
assert.match(route, /source==="schedule"/);
assert.match(route, /status='active'/);
assert.match(route, /subscription_ends_at>\?/);
assert.match(route, /session\.userId/);
assert.match(route, /session\.email/);
assert.doesNotMatch(route, /body\.userId|body\.user_id/);
assert.match(academic, /source:"schedule"/);
assert.match(academic, /\/api\/reminders/);
assert.match(index, /deliverDueImportantReminders/);
console.log("important reminders contract: ok");
