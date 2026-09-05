import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("صفحة هِمّة تعرض السعر الرسمي بوضوح من المصدر الموحد بدون تحويل مباشر غير محمي", async () => {
  const [page, form, styles, pricing] = await Promise.all([
    readFile(new URL("../app/plus/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/plus/InterestForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/plus/plus-simple.css", import.meta.url), "utf8"),
    readFile(new URL("../app/billing/planPricing.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /سعر هِمّة معلن بوضوح/);
  assert.match(page, /PlanPriceInline plan="monthly"/);
  assert.match(page, /قائمة الأسعار/);
  assert.match(pricing, /monthly:\s*2900/);
  assert.match(pricing, /sprint:\s*1100/);
  assert.match(page, /<InterestForm \/>/);
  assert.doesNotMatch(page, /CheckoutPanel/);
  assert.doesNotMatch(page, /السعر الحالي 0 ر\.س|25 ر\.س|12 ر\.س|57 ر\.س|19 سبتمبر 2026|3 \+ 1|سعر مؤسس|عرض مؤسسي|salla\.sa/);
  assert.doesNotMatch(form, /name,setName|الاسم \(اختياري\)/);
  assert.match(form, /JSON\.stringify\(\{ email \}\)/);
  assert.match(styles, /\.plus-status/);
  assert.match(styles, /\.plus-preview/);
  assert.match(styles, /@media\(max-width:560px\)/);
});
