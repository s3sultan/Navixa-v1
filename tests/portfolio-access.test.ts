import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPortfolioGrant, PORTFOLIO_SSO_ENABLED, verifyPortfolioGrant } from "../worker/portfolioAccess.ts";

const membership = { userId: "user-uuid-123", plan: "monthly", status: "trial" as const, endsAt: new Date(Date.now() + 60_000).toISOString() };

async function testKeyPair() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return {
    privateKeyJwk: JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey)),
    publicJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
  };
}

test("تفويض المنظومة يقبل تجربة نشطة فقط للوجهة المحددة", async () => {
  const keys = await testKeyPair();
  const grant = await createPortfolioGrant({ app: "fitness", membership, privateKeyJwk: keys.privateKeyJwk });
  const verified = await verifyPortfolioGrant(grant, "fitness", keys.publicJwk);
  assert.deepEqual(verified, { userId: membership.userId, plan: "monthly", membership: "trial", membershipEndsAt: membership.endsAt });
  assert.equal(await verifyPortfolioGrant(grant, "kids", keys.publicJwk), null);
  assert.equal(grant.includes("@"), false);
});

test("عقد البوابة يبقي المحتوى الأساسي مجانيًا ولا يوسّع كوكي NAVIXA إلى النطاقات الفرعية", () => {
  const auth = readFileSync(new URL("../worker/userAuth.ts", import.meta.url), "utf8");
  const portfolio = readFileSync(new URL("../app/portfolio/page.tsx", import.meta.url), "utf8");
  const access = readFileSync(new URL("../worker/portfolioAccess.ts", import.meta.url), "utf8");
  assert.match(auth, /__Host-navixa_session/);
  assert.doesNotMatch(auth, /Domain=\.navixasa\.com/);
  assert.match(portfolio, /عند انتهاء التجربة أو الاشتراك/);
  assert.match(access, /alg: "ES256"/);
  assert.doesNotMatch(access, /HMAC/);
});

test("كل مواقع المنظومة تستخدم معالج إتمام حي بعد فحص العضوية", () => {
  const route = readFileSync(new URL("../app/api/portfolio/authorize/route.ts", import.meta.url), "utf8");
  assert.equal(PORTFOLIO_SSO_ENABLED.learning, true);
  assert.equal(PORTFOLIO_SSO_ENABLED.fitness, true);
  assert.equal(PORTFOLIO_SSO_ENABLED.kids, true);
  assert.match(route, /PORTFOLIO_APPS/);
});
