import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { publicRuntimeFeatures, runtimeFeatureDefaults } from "../app/runtimeFeatures.ts";

test("مفاتيح التشغيل الجديدة مغلقة افتراضيًا ولا تعرض أسرارًا", () => {
  assert.deepEqual(publicRuntimeFeatures(runtimeFeatureDefaults), {
    floatingAssistantEnabled: false,
    gameAdEnabled: false,
    healthNudgeEnabled: false,
    memberPlatformRibbonEnabled: false,
    matchesHomeEnabled: false,
    usageAnalyticsEnabled: false,
    publicCounterEnabled: false,
  });
});

test("مسارات مفاتيح التشغيل تفصل القراءة العامة عن التعديل الإداري المحمي", async () => {
  const [publicRoute, adminRoute, home, tracker, usageRoute, statsRoute, adminUi, adminPage] = await Promise.all([
    readFile(new URL("../app/api/runtime-features/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/runtime-features/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/UsageTracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/usage/event/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stats/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/settings/AdminRuntimeFeatureSettings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(publicRoute, /publicRuntimeFeatures/);
  assert.match(publicRoute, /Cache-Control.*no-store/);
  assert.doesNotMatch(publicRoute, /SECRET|KEY|TOKEN/i);
  assert.match(adminRoute, /verifyAdminSessionToken/);
  assert.match(adminRoute, /isTrustedSameOriginRequest/);
  assert.match(adminRoute, /Cache-Control.*no-store/);
  assert.match(home, /runtimeFeatures\.matchesHomeEnabled/);
  assert.match(home, /runtimeFeatures\.floatingAssistantEnabled/);
  assert.match(home, /loading="lazy" fetchPriority="low"/);
  assert.match(tracker, /usageAnalyticsEnabled/);
  assert.match(usageRoute, /isRuntimeFeatureEnabled/);
  assert.match(statsRoute, /public_counter_enabled/);
  assert.match(adminUi, /api\/admin\/runtime-features/);
  assert.match(adminPage, /AdminRuntimeFeatureSettings/);
  assert.equal((adminPage.match(/id="activity"/g) || []).length, 1);
  assert.doesNotMatch(adminPage, /const features =/);
});
