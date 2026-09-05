import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const read=(path:string)=>fs.readFileSync(path,"utf8");

test("launch trial has an exact Riyadh end and Wednesday reminder",()=>{
  const trial=read("app/launchTrial.ts");
  assert.match(trial,/2026-09-09T00:00:00\+03:00/);
  assert.match(trial,/2026-09-12T16:00:00\+03:00/);
  assert.match(trial,/Asia\/Riyadh/);
});

test("pricing reflects final trial Azm and Himma model",()=>{
  const pricing=read("app/pricing/page.tsx");
  assert.match(pricing,/كامل مميزات NAVIXA/);
  assert.match(pricing,/مراقبة الشاشة \+ نداء الاسم \+ المزايا المجانية/);
  assert.match(pricing,/استخدام مجاني ومحدود لكامل NAVIXA/);
});

test("reminder is mounted globally and points to both plans",()=>{
  const layout=read("app/layout.tsx");
  const notice=read("app/LaunchTrialNotice.tsx");
  assert.match(layout,/LaunchTrialNotice/);
  assert.match(notice,/href="\/plus"/);
  assert.match(notice,/href="\/sprint"/);
  assert.match(notice,/\/api\/access\/trial/);
});
