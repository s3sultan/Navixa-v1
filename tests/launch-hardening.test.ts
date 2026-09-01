import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [referrals, adminReferrals, plusPage, projectsPage, terms, refunds, privacy] = await Promise.all([
  readFile(new URL("../app/referrals.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/admin/referrals/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/plus/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/projects/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/refunds/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
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

console.log("Launch hardening contract: ok");
