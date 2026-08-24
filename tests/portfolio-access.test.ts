import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPortfolioGrant, verifyPortfolioGrant } from "../worker/portfolioAccess.ts";

const secret = "test-only-portfolio-secret-which-is-long-enough";
const membership = { userId: "user-uuid-123", plan: "monthly", status: "trial" as const, endsAt: new Date(Date.now() + 60_000).toISOString() };

test("تفويض المنظومة يقبل تجربة نشطة فقط للوجهة المحددة", async () => {
  const grant = await createPortfolioGrant({ app: "fitness", membership, secret });
  const verified = await verifyPortfolioGrant(grant, "fitness", secret);
  assert.deepEqual(verified, { userId: membership.userId, plan: "monthly", membership: "trial", membershipEndsAt: membership.endsAt });
  assert.equal(await verifyPortfolioGrant(grant, "kids", secret), null);
  assert.equal(grant.includes("@"), false);
});

test("عقد البوابة يبقي المحتوى الأساسي مجانيًا ولا يوسّع كوكي NAVIXA إلى النطاقات الفرعية", () => {
  const auth = readFileSync(new URL("../worker/userAuth.ts", import.meta.url), "utf8");
  const portfolio = readFileSync(new URL("../app/portfolio/page.tsx", import.meta.url), "utf8");
  assert.match(auth, /__Host-navixa_session/);
  assert.doesNotMatch(auth, /Domain=\.navixasa\.com/);
  assert.match(portfolio, /عند انتهاء التجربة أو الاشتراك/);
});
