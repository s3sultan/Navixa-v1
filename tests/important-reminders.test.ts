import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, route, index, preferences, controls, today] = await Promise.all([
  readFile(new URL("../worker/importantReminders.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/reminders/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/push/preferences/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/PushCategoryControls.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/today/page.tsx", import.meta.url), "utf8"),
]);
assert.match(worker, /UNIQUE\(user_id,title,due_at\)/);
assert.match(worker, /maxAttempts=3/);
assert.match(worker, /email_enabled/);
assert.match(worker, /telegram_enabled/);
assert.match(worker, /push_enabled/);
assert.match(worker, /source/);
assert.match(worker, /isUserPushCategoryActive/);
assert.match(worker, /schedule/);
assert.match(worker, /navixa_user_telegram_links/);
assert.match(worker, /navixa_push_subscriptions/);
assert.match(worker, /sendFeaturePush/);
assert.match(route, /trustedUserMutation/);
assert.match(route, /private, no-store/);
assert.match(route, /\(!email&&!telegram&&!push\)/);
assert.match(route, /push_enabled/);
assert.match(route, /body\.source==="schedule"/);
assert.match(preferences, /trustedUserMutation/);
assert.match(preferences, /resolveUserSession/);
assert.match(preferences, /7\*24\*60/);
assert.match(preferences, /category/);
assert.match(controls, /Push الأذان/);
assert.match(controls, /Push الجدول/);
assert.match(controls, /غفوة مؤقتة/);
assert.match(controls, /استئناف الآن/);
assert.match(today, /source:"schedule"/);
assert.match(today, /dueAt:dueAt\.toISOString/);
assert.match(index, /deliverDueImportantReminders/);
console.log("important reminders contract: ok");
