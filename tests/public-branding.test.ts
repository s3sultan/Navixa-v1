import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root=new URL("../",import.meta.url);

test("public plan badges use Himma and Azm names",async()=>{
  const badges=await readFile(new URL("app/PlanBadges.tsx",root),"utf8");
  assert.match(badges,/>هِمّة<\/Link>/);
  assert.match(badges,/>عَزْم<\/Link>/);
  assert.doesNotMatch(badges,/>PLUS<\/Link>|>SPRINT<\/Link>/);
});

test("homepage source uses Himma directly and has no founders promotion entry points",async()=>{
  const [page,layout]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/layout.tsx",root),"utf8"),
  ]);
  assert.match(page,/<em className="plus-badge">هِمّة<\/em>/);
  assert.doesNotMatch(page,/<em className="plus-badge">Plus<\/em>/);
  assert.doesNotMatch(page,/welcome-founders-link|>عرض المؤسسين</);
  assert.doesNotMatch(layout,/branding-overrides\.css/);
});

test("pricing shortcut stays mounted beside account entries on desktop and mobile",async()=>{
  const [layout,shortcut,styles]=await Promise.all([
    readFile(new URL("app/layout.tsx",root),"utf8"),
    readFile(new URL("app/PricingHeaderShortcut.tsx",root),"utf8"),
    readFile(new URL("app/pricing-header-shortcut.css",root),"utf8"),
  ]);
  assert.match(layout,/PricingHeaderShortcut/);
  assert.match(shortcut,/PRICING_PATH="\/pricing"/);
  assert.match(shortcut,/topbar-actions a\[href="\/account"\]/);
  assert.match(shortcut,/mobile-hub-account/);
  assert.match(shortcut,/MutationObserver/);
  assert.match(shortcut,/data-navixa-pricing-slot/);
  assert.match(shortcut,/pageshow/);
  assert.match(shortcut,/فتح قائمة أسعار NAVIXA/);
  assert.match(styles,/topbar-pricing-shortcut/);
  assert.match(styles,/mobile-hub-pricing-shortcut/);
  assert.match(styles,/display:inline-flex!important/);
  assert.match(styles,/visibility:visible!important/);
  assert.match(styles,/opacity:1!important/);
});

test("Arabic subscription copy no longer presents Plus as the public plan name",async()=>{
  const copy=await readFile(new URL("app/content/ar.ts",root),"utf8");
  assert.match(copy,/NAVIXA هِمّة/);
  assert.match(copy,/هِمّة أو عَزْم/);
  assert.doesNotMatch(copy,/NAVIXA PLUS|مزايا Plus|يضيف Plus/);
});
