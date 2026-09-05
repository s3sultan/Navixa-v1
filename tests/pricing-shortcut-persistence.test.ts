import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("pricing shortcut stays available on desktop and mobile after rerenders",async()=>{
  const source=await readFile(new URL("../app/PricingHeaderShortcut.tsx",import.meta.url),"utf8");
  const css=await readFile(new URL("../app/pricing-header-shortcut.css",import.meta.url),"utf8");
  assert.match(source,/MutationObserver/);
  assert.match(source,/topbar-actions a\[href="\/account"\]/);
  assert.match(source,/mobile-hub-account/);
  assert.match(source,/data-navixa-pricing-slot/);
  assert.match(source,/pageshow/);
  assert.match(css,/display:inline-flex!important/);
  assert.match(css,/visibility:visible!important/);
  assert.match(css,/opacity:1!important/);
});
