import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, route, index] = await Promise.all([
  readFile(new URL("../worker/importantReminders.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/reminders/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
]);
assert.match(worker, /UNIQUE\(user_id,title,due_at\)/);
assert.match(worker, /maxAttempts=3/);
assert.match(worker, /email_enabled/);
assert.match(worker, /telegram_enabled/);
assert.match(worker, /navixa_user_telegram_links/);
assert.match(route, /trustedUserMutation/);
assert.match(route, /private, no-store/);
assert.match(route, /\(!email&&!telegram\)/);
assert.match(index, /deliverDueImportantReminders/);
console.log("important reminders contract: ok");
