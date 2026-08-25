import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [robots, sitemap, worker, organizer, meetings, reminders, privacy] = await Promise.all([
  readFile(new URL("../app/robots.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/organize-your-day/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/meeting-summaries/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/smart-reminders/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/local-privacy/page.tsx", import.meta.url), "utf8"),
]);

assert.match(robots, /https:\/\/navixasa\.com/);
assert.doesNotMatch(robots, /s2shug\.workers\.dev/);
assert.match(sitemap, /https:\/\/navixasa\.com/);
assert.match(sitemap, /organize-your-day|meeting-summaries|smart-reminders|local-privacy/);
assert.match(worker, /Strict-Transport-Security/);
assert.match(worker, /X-Content-Type-Options/);
assert.match(worker, /Content-Security-Policy-Report-Only/);
assert.match(worker, /report-uri \/api\/security\/csp-report/);
assert.match(worker, /static\.cloudflareinsights\.com/);
assert.match(worker, /fonts\.googleapis\.com/);
assert.match(worker, /accounts\.google\.com/);
assert.match(worker, /cdn\.jsdelivr\.net/);
assert.doesNotMatch(worker, /set\("Content-Security-Policy", CSP_REPORT_ONLY/);
for (const page of [organizer, meetings, reminders, privacy]) assert.match(page, /alternates: \{ canonical:/);
console.log("SEO and browser-security baseline contract: ok");
