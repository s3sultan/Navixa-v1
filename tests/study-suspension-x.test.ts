import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyStudySuspensionDecision,
  normalizeOfficialXPost,
  type StudySuspensionXSource,
} from "../worker/studySuspensionX.ts";

const source: StudySuspensionXSource = {
  sourceId: "education-admin:riyadh",
  source: {
    entityType: "education_admin",
    entityId: "riyadh-education",
    name: "إدارة تعليم الرياض",
    verified: true,
    officialAccountId: "123456789",
  },
  username: "MOE_RYH",
  accountId: "123456789",
  educationType: "general",
  scopeType: "education_admin",
  scopeIds: ["riyadh-education"],
};

test("official X decision classifier ignores unrelated education posts", () => {
  assert.equal(classifyStudySuspensionDecision("نبارك للطلاب والطالبات بمناسبة اليوم الوطني"), null);
  assert.equal(classifyStudySuspensionDecision("دعوة لحضور معرض التعليم والتقنية"), null);
});

test("remote learning wins when an official post suspends in-person study and moves it online", () => {
  assert.equal(
    classifyStudySuspensionDecision("تعليق الدراسة الحضورية وتحويل الدراسة عن بُعد عبر منصة مدرستي غدًا"),
    "remote",
  );
});

test("classifier distinguishes suspension delay resume and cancellation", () => {
  assert.equal(classifyStudySuspensionDecision("تقرر تعليق الدراسة الحضورية غدًا"), "suspend");
  assert.equal(classifyStudySuspensionDecision("تأخير بداية الدوام الدراسي إلى الساعة التاسعة"), "delay");
  assert.equal(classifyStudySuspensionDecision("استئناف الدراسة الحضورية غدًا"), "resume");
  assert.equal(classifyStudySuspensionDecision("إلغاء قرار تعليق الدراسة السابق"), "cancel");
});

test("normalization keeps the trusted registry scope instead of inferring it from post text", () => {
  const event = normalizeOfficialXPost(source, {
    id: "200",
    text: "تعليق الدراسة الحضورية في مدينة أخرى حسب ما ورد في القرار",
    created_at: "2026-09-09T01:00:00Z",
  });
  assert.ok(event);
  assert.equal(event.source.entityId, "riyadh-education");
  assert.equal(event.source.officialAccountId, "123456789");
  assert.deepEqual(event.scope, { type: "education_admin", ids: ["riyadh-education"] });
  assert.equal(event.verification, "official_primary");
  assert.equal(event.sourceUrl, "https://x.com/MOE_RYH/status/200");
});

test("unverified registry entries cannot become official events", () => {
  const event = normalizeOfficialXPost(
    { ...source, source: { ...source.source, verified: false } },
    { id: "201", text: "تعليق الدراسة الحضورية غدًا" },
  );
  assert.equal(event, null);
});
