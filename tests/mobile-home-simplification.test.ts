import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../app/page.tsx", import.meta.url);
const stylePath = new URL("../app/navixa.css", import.meta.url);

test("واجهة الجوال تعرض الأساسيات فقط وتبقي الأدوات الثانوية خلف المزيد", async () => {
  const [page, styles] = await Promise.all([readFile(pagePath, "utf8"), readFile(stylePath, "utf8")]);
  assert.match(page, /mobile-home-hub/);
  assert.match(page, /mobileMoreOpen/);
  assert.match(page, /سماع اسم أو كلمة/);
  assert.match(page, /متابعة الشاشة/);
  assert.match(page, /تلخيص اجتماع/);
  assert.match(page, /عرض كل الأدوات والتفاصيل/);
  assert.match(styles, /\.mobile-home-hub\{display:grid/);
  assert.match(styles, /\.priority-feature-grid,.privacy-promise,.member-platform-ribbon,.matches-ribbon,.secondary-paths,.secondary-footer-tools\{display:none!important\}/);
});
