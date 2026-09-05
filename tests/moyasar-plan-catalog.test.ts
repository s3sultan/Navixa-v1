import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("public pricing defaults are Himma 29 SAR and Azm 11 SAR",()=>{
  const pricing=read("app/billing/planPricing.ts");
  const publicCatalog=read("app/api/billing/catalog/route.ts");
  const pricingPage=read("app/pricing/page.tsx");
  assert.match(pricing,/monthly:\s*2900/);
  assert.match(pricing,/sprint:\s*1100/);
  assert.match(pricingPage,/amount:2900/);
  assert.match(pricingPage,/amount:1100/);
  assert.match(publicCatalog,/source:"admin-verified"/);
});

test("checkout derives base amount from server-side admin settings",()=>{
  const checkout=read("app/api/billing/checkout/route.ts");
  const admin=read("app/api/admin/plan-pricing/route.ts");
  assert.match(checkout,/configuredAmount\(current,plan\)/);
  assert.match(checkout,/monthly_price_halalas/);
  assert.match(checkout,/sprint_price_halalas/);
  assert.doesNotMatch(checkout,/body\.amount/);
  assert.match(checkout,/priceSource:"admin-verified"/);
  assert.match(admin,/verified\.monthly!==monthly\|\|verified\.sprint!==sprint/);
});

test("plan pages use the canonical public price component instead of stale numbers",()=>{
  const plus=read("app/plus/page.tsx");
  const sprint=read("app/sprint/page.tsx");
  assert.match(plus,/PlanPriceInline plan="monthly"/);
  assert.match(sprint,/PlanPriceInline plan="sprint"/);
  assert.doesNotMatch(plus,/25 ر\.س/);
  assert.doesNotMatch(sprint,/12 ر\.س/);
});

test("Sprint activates for five days in verify and webhook paths",()=>{
  const verify=read("app/api/billing/verify/route.ts");
  const webhook=read("app/api/billing/webhook/route.ts");
  assert.match(verify,/intent\.plan==="sprint"\?5:30/);
  assert.match(webhook,/plan==="sprint"\?5:30/);
  assert.match(verify,/\['monthly','sprint'\]/);
  assert.match(webhook,/\['monthly','sprint'\]/);
});
