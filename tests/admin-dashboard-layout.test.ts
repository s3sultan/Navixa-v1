import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("لوحة الإدارة الجديدة تستخدم بطاقات تشغيل مرتبطة ببيانات فعلية فقط", async () => {
  const [page, overview, styles] = await Promise.all([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminOverview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/dashboard-v2.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /dashboard-v2/);
  assert.match(page, /<AdminOverview onNavigate=\{go\}/);
  assert.match(page, /AdminRuntimeFeatureSettings/);
  assert.match(page, /AdminPerformanceDashboard/);
  assert.doesNotMatch(page, /Google Calendar", "جاهز/);
  assert.doesNotMatch(page, /فتح مكتبة التمارين/);
  assert.match(overview, /api\/admin\/usage-analytics/);
  assert.match(overview, /api\/admin\/performance/);
  assert.match(overview, /api\/admin\/site-health/);
  assert.match(overview, /api\/admin\/runtime-features/);
  assert.match(overview, /لا تعرض أرقامًا تقديرية/);
  assert.match(overview, /بانتظار عينة كافية قبل عرض قراءة أداء موثوقة/);
  assert.match(styles, /\.admin-shell\.dashboard-v2/);
  assert.match(styles, /@media\(max-width:620px\)/);
});
