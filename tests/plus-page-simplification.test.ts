import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("صفحة Plus المبسطة لا تعرض خططًا أو أسعارًا أو تحويلًا عامًا للدفع", async () => {
  const [page, form, styles] = await Promise.all([
    readFile(new URL("../app/plus/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/plus/InterestForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/plus/plus-simple.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Plus جاهز للتجهيز، والدفع ننتظر اعتماده/);
  assert.match(page, /لا دفع حاليًا/);
  assert.match(page, /لا توجد عملية دفع أو طلب بطاقة/);
  assert.match(page, /<InterestForm \/>/);
  assert.doesNotMatch(page, /CheckoutPanel/);
  assert.doesNotMatch(page, /19 ر\.س|57 ر\.س|19 سبتمبر 2026|3 \+ 1|salla\.sa/);
  assert.doesNotMatch(form, /name,setName|الاسم \(اختياري\)/);
  assert.match(form, /JSON\.stringify\(\{ email \}\)/);
  assert.match(styles, /\.plus-status/);
  assert.match(styles, /\.plus-preview/);
  assert.match(styles, /@media\(max-width:560px\)/);
});
