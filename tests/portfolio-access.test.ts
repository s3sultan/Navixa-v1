import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPortfolioGrant, portfolioRoleAllowsApp, PORTFOLIO_SSO_ENABLED, verifyPortfolioGrant } from "../worker/portfolioAccess.ts";

const activePlusMembership = {
  userId: "user-uuid-123",
  plan: "plus",
  status: "active" as const,
  role: "owner" as const,
  endsAt: new Date(Date.now() + 60_000).toISOString(),
};

async function testKeyPair() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return {
    privateKeyJwk: JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey)),
    publicJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
  };
}

test("تفويض المنظومة يقبل Plus نشطًا فقط وللوجهة المحددة", async () => {
  const keys = await testKeyPair();
  const grant = await createPortfolioGrant({ app: "fitness", membership: activePlusMembership, privateKeyJwk: keys.privateKeyJwk });
  const verified = await verifyPortfolioGrant(grant, "fitness", keys.publicJwk);
  assert.deepEqual(verified, {
    userId: activePlusMembership.userId,
    plan: "plus",
    membership: "active",
    role: "owner",
    membershipEndsAt: activePlusMembership.endsAt,
  });
  assert.equal(await verifyPortfolioGrant(grant, "kids", keys.publicJwk), null);
  assert.equal(grant.includes("@"), false);
});

test("تفويض المنظومة يرفض التجربة والخطط غير Plus", async () => {
  const keys = await testKeyPair();
  const trialMembership = { userId: "trial-user", plan: "plus", status: "trial" as const, endsAt: new Date(Date.now() + 60_000).toISOString() };
  const monthlyMembership = { userId: "monthly-user", plan: "monthly", status: "active" as const, endsAt: new Date(Date.now() + 60_000).toISOString() };
  const trialGrant = await createPortfolioGrant({ app: "learning", membership: trialMembership as never, privateKeyJwk: keys.privateKeyJwk });
  const monthlyGrant = await createPortfolioGrant({ app: "learning", membership: monthlyMembership as never, privateKeyJwk: keys.privateKeyJwk });
  assert.equal(await verifyPortfolioGrant(trialGrant, "learning", keys.publicJwk), null);
  assert.equal(await verifyPortfolioGrant(monthlyGrant, "learning", keys.publicJwk), null);
});

test("أدوار العضوية لا توسع الوصول خارج الاستحقاق المركزي", () => {
  for (const app of ["fitness", "kids", "learning"] as const) {
    assert.equal(portfolioRoleAllowsApp("owner", "", app), true);
    assert.equal(portfolioRoleAllowsApp("full", "", app), true);
  }

  assert.equal(portfolioRoleAllowsApp("project", "fitness", "fitness"), true);
  assert.equal(portfolioRoleAllowsApp("project", "fitness", "kids"), false);
  assert.equal(portfolioRoleAllowsApp("project", "fitness", "learning"), false);

  assert.equal(portfolioRoleAllowsApp("child", "kids", "kids"), true);
  assert.equal(portfolioRoleAllowsApp("child", "kids", "fitness"), false);
  assert.equal(portfolioRoleAllowsApp("child", "kids", "learning"), false);
});

test("المنحة الموقعة تحمل دور العضو دون كشف البريد", async () => {
  const keys = await testKeyPair();
  const member = {
    userId: "member-user-123",
    plan: "plus",
    status: "active" as const,
    role: "project" as const,
    endsAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const grant = await createPortfolioGrant({ app: "learning", membership: member, privateKeyJwk: keys.privateKeyJwk });
  const verified = await verifyPortfolioGrant(grant, "learning", keys.publicJwk);
  assert.equal(verified?.role, "project");
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
  assert.match(access, /navixa_portfolio_memberships/);
  assert.doesNotMatch(access, /HMAC/);
});

test("كل مواقع المنظومة تستخدم معالج إتمام حي بعد فحص العضوية", () => {
  const route = readFileSync(new URL("../app/api/portfolio/authorize/route.ts", import.meta.url), "utf8");
  assert.equal(PORTFOLIO_SSO_ENABLED.learning, true);
  assert.equal(PORTFOLIO_SSO_ENABLED.fitness, true);
  assert.equal(PORTFOLIO_SSO_ENABLED.kids, true);
  assert.match(route, /PORTFOLIO_APPS/);
});
