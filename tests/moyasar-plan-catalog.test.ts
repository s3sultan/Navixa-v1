import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("Plus and Sprint prices are consistent across public pages and checkout",()=>{
  const plus=read("app/plus/page.tsx");
  const sprint=read("app/sprint/page.tsx");
  const checkout=read("app/api/billing/checkout/route.ts");
  assert.match(plus,/25 ر\.س \/ شهر/);
  assert.match(sprint,/12 ر\.س لمدة خمسة أيام/);
  assert.match(checkout,/monthly:\{amount:2500/);
  assert.match(checkout,/sprint:\{amount:1200/);
});

test("Sprint activates for five days in verify and webhook paths",()=>{
  const verify=read("app/api/billing/verify/route.ts");
  const webhook=read("app/api/billing/webhook/route.ts");
  assert.match(verify,/intent\.plan==="sprint"\?5:30/);
  assert.match(webhook,/plan==="sprint"\?5:30/);
  assert.match(verify,/\['monthly','sprint'\]/);
  assert.match(webhook,/\['monthly','sprint'\]/);
});
