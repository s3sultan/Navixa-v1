import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("صفحة المراجعة تعرض الأسعار والمدد والسياسات بدون عروض", async () => {
  const page = await readFile(new URL("../app/review/page.tsx", import.meta.url), "utf8");
  assert.match(page, /12 ر\.س/);
  assert.match(page, /5 أيام متتالية/);
  assert.match(page, /25 ر\.س/);
  assert.match(page, /شهر واحد/);
  assert.match(page, /سياسة الخصوصية/);
  assert.match(page, /سياسة الإلغاء والاسترداد/);
  assert.match(page, /سياسة التسليم والتنفيذ/);
  assert.match(page, /سياسة الشكاوى والمقترحات/);
  assert.doesNotMatch(page, /9 ر\.س|19 ر\.س|57 ر\.س|3 \+ 1|سعر مؤسس|عرض مؤسسي/);
});

test("صفحة Sprint تعرض السعر القياسي المعتمد", async () => {
  const page = await readFile(new URL("../app/sprint/page.tsx", import.meta.url), "utf8");
  assert.match(page, /12 ر\.س/);
  assert.match(page, /خمسة أيام متتالية/);
  assert.doesNotMatch(page, /9 ر\.س|سعر مؤسس|عرض مؤسسي/);
});
