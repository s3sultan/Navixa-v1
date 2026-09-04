import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  referrals,
  adminReferrals,
  plusPage,
  projectsPage,
  terms,
  refunds,
  privacy,
  productionDeploy,
  stagingDeploy,
  setupPush,
  resetCounters,
  geminiBridge,
  manusBridge,
  stagingLoad,
  stagingSoak,
  prVerify,
] = await Promise.all([
  readFile(new URL("../app/referrals.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/admin/referrals/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/plus/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/projects/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/refunds/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/deploy-navixa.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/deploy-navixa-staging.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/setup-navixa-production-push.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/reset-navixa-production-counters.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/gemini-task.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/manus-task.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/staging-load-test.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/staging-soak-test.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/pr-verify.yml", import.meta.url), "utf8"),
]);

assert.match(referrals, /referred_contact=\? AND \(status='rewarded' OR \(status='pending' AND expires_at>\?\)\)/);
assert.match(referrals, /referred_contact_already_rewarded/);
assert.match(referrals, /referrer_inactive/);
assert.match(adminReferrals, /referrer_profile_id=\?/);
assert.doesNotMatch(adminReferrals, /referral_profile_id=\?/);
assert.match(adminReferrals, /status='pending_credit'/);

assert.match(plusPage, /أبلغني عند فتح هِمّة/);
assert.match(plusPage, /كمبيوتر واحد وجوال واحد/);
assert.match(plusPage, /لا توجد عملية دفع أو طلب بطاقة/);
assert.match(plusPage, /ابدأ بعَزْم، وكمل بهِمّة|هِمّة/);
assert.match(projectsPage, /عضوية هِمّة النشطة/);
assert.match(projectsPage, /مشمول مع هِمّة/);
assert.doesNotMatch(projectsPage, />PLUS • YOUR NAVIXA</);
assert.doesNotMatch(projectsPage, /عضوية Plus النشطة/);
assert.match(terms, /الإحالات والمكافآت/);
assert.match(refunds, /الإحالات والمكافآت المرتبطة بالدفع/);
assert.match(privacy, /الحساب وتسجيل الدخول/);
assert.match(privacy, /هِمّة والدفع/);

// Production must not deploy just because code was pushed to master. Only the
// repository owner may dispatch it, with an explicit phrase, from reviewed
// master history associated with a merged pull request.
assert.match(productionDeploy, /workflow_dispatch:/);
assert.match(productionDeploy, /confirm_production:/);
assert.match(productionDeploy, /github\.actor == github\.repository_owner/);
assert.match(productionDeploy, /github\.ref == 'refs\/heads\/master'/);
assert.match(productionDeploy, /DEPLOY_NAVIXA_PRODUCTION/);
assert.match(productionDeploy, /pull-requests: read/);
assert.match(productionDeploy, /Require merged pull request provenance/);
assert.match(productionDeploy, /commits\/\$\{GITHUB_SHA\}\/pulls/);
assert.match(productionDeploy, /merged_at != null/);
assert.doesNotMatch(productionDeploy, /^\s+push:\s*$/m);
assert.match(productionDeploy, /persist-credentials: false/);

// Deployment credentials and provider secrets must not exist at job scope,
// where npm install/build steps could inherit them. They are injected only into
// the exact deployment/secret-upload steps that need them.
const productionJobPrefix = productionDeploy.slice(0, productionDeploy.indexOf("    steps:"));
assert.doesNotMatch(productionJobPrefix, /ADMIN_JWT_SECRET|CLOUDFLARE_API_TOKEN|MOYASAR_|NAVIXA_TELEGRAM_|RESEND_API_KEY/);
assert.match(productionDeploy, /Install dependencies without deployment secrets/);
assert.match(productionDeploy, /Require production secret readiness/);

const stagingJobPrefix = stagingDeploy.slice(0, stagingDeploy.indexOf("    steps:"));
assert.doesNotMatch(stagingJobPrefix, /ADMIN_JWT_SECRET|CLOUDFLARE_API_TOKEN/);
assert.match(stagingDeploy, /github\.actor == github\.repository_owner/);
assert.match(stagingDeploy, /persist-credentials: false/);
assert.match(stagingDeploy, /Install dependencies without deployment secrets/);
assert.match(stagingDeploy, /ADMIN_JWT_SECRET_STAGING must be at least 32 characters/);

// Production maintenance helpers are owner-only, master-only, and never leave
// the checkout token persisted in local git configuration.
for (const workflow of [setupPush, resetCounters]) {
  assert.match(workflow, /github\.actor == github\.repository_owner/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/master'/);
  assert.match(workflow, /persist-credentials: false/);
}
assert.match(setupPush, /--name navixa/);
assert.match(setupPush, /https:\/\/navixasa\.com/);

// External AI bridges may expose bounded repository context, so even manual
// dispatch is reserved for the repository owner.
for (const workflow of [geminiBridge, manusBridge]) {
  assert.match(workflow, /github\.actor == github\.repository_owner/);
  assert.match(workflow, /persist-credentials: false/);
}

// Load/soak helpers cannot be repurposed as generic traffic generators against
// arbitrary HTTPS hosts.
for (const workflow of [stagingLoad, stagingSoak]) {
  assert.match(workflow, /github\.actor == github\.repository_owner/);
  assert.match(workflow, /https:\/\/navixa-staging\.s2shug\.workers\.dev/);
  assert.match(workflow, /staging_url must be the NAVIXA staging Worker/);
}

assert.match(prVerify, /persist-credentials: false/);

console.log("Launch hardening contract: ok");
