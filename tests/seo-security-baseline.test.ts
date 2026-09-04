import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [robots, sitemap, worker, organizer, meetings, reminders, privacy, nextConfig, userAuth, portfolioAuthorize] = await Promise.all([
  readFile(new URL("../app/robots.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/organize-your-day/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/meeting-summaries/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/smart-reminders/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/local-privacy/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/userAuth.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/portfolio/authorize/route.ts", import.meta.url), "utf8"),
]);

assert.match(robots, /https:\/\/navixasa\.com/);
assert.doesNotMatch(robots, /s2shug\.workers\.dev/);
assert.match(sitemap, /https:\/\/navixasa\.com/);
assert.match(sitemap, /organize-your-day|meeting-summaries|smart-reminders|local-privacy/);
assert.match(sitemap, /guides/);
assert.match(worker, /Strict-Transport-Security/);
assert.match(worker, /X-Content-Type-Options/);
assert.match(worker, /X-Permitted-Cross-Domain-Policies/);
assert.match(worker, /const CSP_ENFORCED = \[/);
assert.match(worker, /base-uri 'self'/);
assert.match(worker, /object-src 'none'/);
assert.match(worker, /frame-ancestors 'self'/);
assert.match(worker, /frame-src 'self' https:\/\/accounts\.google\.com/);
assert.match(worker, /form-action 'self'/);
assert.match(worker, /manifest-src 'self'/);
assert.match(worker, /script-src-attr 'none'/);
assert.match(worker, /set\("Content-Security-Policy", CSP_ENFORCED\)/);
assert.match(worker, /Content-Security-Policy-Report-Only/);
assert.match(worker, /report-uri \/api\/security\/csp-report/);
assert.match(worker, /static\.cloudflareinsights\.com/);
assert.match(worker, /fonts\.googleapis\.com/);
assert.match(worker, /accounts\.google\.com/);
assert.match(worker, /cdn\.jsdelivr\.net/);
assert.doesNotMatch(worker, /set\("Content-Security-Policy", CSP_REPORT_ONLY/);
assert.match(worker, /consumeAuthRateLimit/);
assert.match(worker, /public-mutation:\$\{url\.pathname\}/);
assert.match(worker, /await publicMutationGuard\(request, url, env\)/);
for (const page of [organizer, meetings, reminders, privacy]) assert.match(page, /alternates: \{ canonical:/);
assert.match(organizer, /href="\/guides"/);

// NAVIXA authentication has one canonical host. Keeping the secure __Host cookie
// host-only avoids exposing the main session to Kids/Learning/Fitness while the
// www host redirects to the apex before authentication or portfolio SSO runs.
assert.match(nextConfig, /type: "host", value: "www\.navixasa\.com"/);
assert.match(nextConfig, /destination: "https:\/\/navixasa\.com\/:path\*"/);
assert.match(userAuth, /__Host-navixa_session/);
assert.doesNotMatch(userAuth, /Domain=\.navixasa\.com/);
assert.match(portfolioAuthorize, /resolvePortfolioMembership/);
assert.match(portfolioAuthorize, /\/account/);

console.log("SEO, canonical auth host, and browser-security baseline contract: ok");
