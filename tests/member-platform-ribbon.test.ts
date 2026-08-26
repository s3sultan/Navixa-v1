import assert from "node:assert/strict";
import test from "node:test";
import { platformAnnouncements } from "../app/MemberPlatformRibbon";

test("منصات شريط العضوية الثلاث تستخدم التفويض المركزي من دون تمرير بيانات المستخدم", () => {
  assert.deepEqual(platformAnnouncements.map(item => item.app), ["learning", "fitness", "kids"]);
  for (const item of platformAnnouncements) {
    assert.match(item.title, /\S/);
    assert.match(item.detail, /\S/);
    assert.match(item.cta, /\S/);
  }
});
