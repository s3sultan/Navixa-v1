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

test("صفحات السياسات العامة لا تعرض ملاحظات إدارية داخلية", async () => {
  const files = [
    new URL("../app/terms/page.tsx", import.meta.url),
    new URL("../app/refunds/page.tsx", import.meta.url),
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const phrase of forbiddenPublicNotes) {
      assert.equal(source.includes(phrase), false, `${file.pathname} exposes internal note: ${phrase}`);
    }
  }
});
