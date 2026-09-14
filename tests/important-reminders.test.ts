import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, background, route, index, academic, preferences, controls, today, vite] = await Promise.all([
  readFile(new URL("../worker/importantReminders.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/backgroundAcademic.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/reminders/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/academicReminders.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/push/preferences/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/PushCategoryControls.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/today/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
]);
assert.match(worker, /UNIQUE\(user_id,title,due_at\)/);
assert.match(worker, /maxAttempts=3/);
assert.match(worker, /scheduleFreshness=10\*60_000/);
assert.match(worker, /push_status='skipped'/);
assert.match(worker, /email_enabled/);
assert.match(worker, /telegram_enabled/);
assert.match(worker, /push_enabled/);
assert.match(worker, /source TEXT NOT NULL DEFAULT 'manual'/);
assert.match(worker, /isUserPushCategoryActive/);
assert.match(worker, /navixa_user_telegram_links/);
assert.match(worker, /navixa_push_subscriptions/);
assert.match(worker, /sendFeaturePush/);
assert.match(worker, /row\.source==="schedule"|source==="schedule"/);
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
assert.match(background, /WorkflowEntrypoint/);
assert.match(background, /ACADEMIC_ALERT_QUEUE/);
assert.match(background, /deliverDueImportantReminders/);
assert.match(background, /message\.retry\(\{delaySeconds\}\)/);
assert.match(index, /triggerAcademicReminderWorkflow/);
assert.match(index, /consumeAcademicReminderQueue/);
assert.doesNotMatch(index, /deliverDueMatchPushes/);
assert.doesNotMatch(index, /ctx\.waitUntil\(deliverDueImportantReminders/);
assert.match(vite, /ACADEMIC_REMINDER_WORKFLOW/);
assert.match(vite, /navixa-academic-alerts/);
assert.match(vite, /navixa-academic-alerts-dlq/);
assert.match(vite, /dead_letter_queue: "navixa-academic-alerts-dlq"/);
console.log("important reminders contract: ok");
