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

test("homepage hides founders promotion entry points and replaces legacy Plus badges visually",async()=>{
  const [layout,overrides]=await Promise.all([
    readFile(new URL("app/layout.tsx",root),"utf8"),
    readFile(new URL("app/branding-overrides.css",root),"utf8"),
  ]);
  assert.match(layout,/branding-overrides\.css/);
  assert.match(overrides,/\.welcome-founders-link/);
  assert.match(overrides,/\.topbar-actions \.topbar-plus/);
  assert.match(overrides,/content: "هِمّة"/);
});

test("Arabic subscription copy no longer presents Plus as the public plan name",async()=>{
  const copy=await readFile(new URL("app/content/ar.ts",root),"utf8");
  assert.match(copy,/NAVIXA هِمّة/);
  assert.match(copy,/هِمّة أو عَزْم/);
  assert.doesNotMatch(copy,/NAVIXA PLUS|مزايا Plus|يضيف Plus/);
});
