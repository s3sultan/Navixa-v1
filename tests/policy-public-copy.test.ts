import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const forbiddenPublicNotes = [
  "ملاحظة إدارية",
  "تُراجع هذه الشروط قانونيًا",
  "منشورة بعد اعتماد الإدارة",
  "لا تمنح المستخدم صلاحية تعديل النص",
  "هذه الصياغة منشورة",
];

const policyFiles = [
  new URL("../app/terms/page.tsx", import.meta.url),
  new URL("../app/privacy/page.tsx", import.meta.url),
  new URL("../app/refunds/page.tsx", import.meta.url),
  new URL("../app/support/page.tsx", import.meta.url),
];

test("صفحات السياسات العامة لا تعرض ملاحظات إدارية داخلية", async () => {
  for (const file of policyFiles) {
    const source = await readFile(file, "utf8");
    for (const phrase of forbiddenPublicNotes) {
      assert.equal(source.includes(phrase), false, `${file.pathname} exposes internal note: ${phrase}`);
    }
  }
});

test("الوثائق الرسمية لا تستخدم أسماء Plus أو Sprint القديمة", async () => {
  for (const file of policyFiles) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /\bPlus\b|\bSprint\b/, `${file.pathname} contains a legacy public plan name`);
  }
  const refunds = await readFile(new URL("../app/refunds/page.tsx", import.meta.url), "utf8");
  assert.match(refunds, /عَزْم/);
  assert.match(refunds, /هِمّة/);
});

test("الشروط والخصوصية والاسترداد توضح صلاحية التطوير مع حماية الحقوق الإلزامية", async () => {
  const terms = await readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8");
  const privacy = await readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
  const refunds = await readFile(new URL("../app/refunds/page.tsx", import.meta.url), "utf8");
  assert.match(terms, /تحتفظ إدارة NAVIXA بالحق/);
  assert.match(terms, /الحقوق الإلزامية/);
  assert.match(privacy, /يجوز لإدارة NAVIXA تحديث هذه السياسة/);
  assert.match(privacy, /الحقوق الإلزامية/);
  assert.match(refunds, /يجوز لإدارة NAVIXA تحديث هذه السياسة/);
  assert.match(refunds, /حق إلزامي/);
});

test("السياسات الأربع تستخدم تنقل الوثائق الرسمي", async () => {
  for (const file of policyFiles) {
    const source = await readFile(file, "utf8");
    assert.match(source, /LegalPolicyNav/);
  }
});
