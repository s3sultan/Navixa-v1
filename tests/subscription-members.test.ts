import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { memberCanAccessProject, NAVIXA_MEMBER_POLICY, normalizeMemberEmail, seatLimit } from "../worker/subscriptionMembers.ts";

test("سياسة عضوية Plus تطبق الحدود المعتمدة", () => {
  assert.equal(NAVIXA_MEMBER_POLICY.fullMembers, 1);
  assert.equal(NAVIXA_MEMBER_POLICY.paidProjectMembers, 1);
  assert.equal(NAVIXA_MEMBER_POLICY.kidsMembers, 2);
  assert.equal(NAVIXA_MEMBER_POLICY.lockDays, 21);
  assert.equal(NAVIXA_MEMBER_POLICY.cooldownDays, 7);
  assert.equal(seatLimit("full_member"), 1);
  assert.equal(seatLimit("project_member"), 1);
  assert.equal(seatLimit("kid"), 2);
});

test("العضو الشامل يفتح المشاريع كلها وعضو المشروع لا يتجاوز مشروعه", () => {
  assert.equal(memberCanAccessProject("full_member", "", "learning"), true);
  assert.equal(memberCanAccessProject("full_member", "", "fitness"), true);
  assert.equal(memberCanAccessProject("full_member", "", "kids"), true);
  assert.equal(memberCanAccessProject("project_member", "learning", "learning"), true);
  assert.equal(memberCanAccessProject("project_member", "learning", "fitness"), false);
  assert.equal(memberCanAccessProject("kid", "kids", "kids"), true);
  assert.equal(memberCanAccessProject("kid", "kids", "learning"), false);
});

test("البريد يطبع قبل مقارنة العضويات", () => {
  assert.equal(normalizeMemberEmail("  MEMBER@Example.COM "), "member@example.com");
});

test("بوابة المشاريع تمرر المشروع المطلوب لفحص الصلاحية", () => {
  const route = readFileSync(new URL("../app/api/portfolio/authorize/route.ts", import.meta.url), "utf8");
  const access = readFileSync(new URL("../worker/portfolioAccess.ts", import.meta.url), "utf8");
  assert.match(route, /resolvePortfolioMembership\(request, env\.DB, requested\)/);
  assert.match(access, /memberCanAccessProject/);
  assert.match(access, /member\.role !== "full_member"/);
  assert.match(access, /s\.status='active'/);
});

test("قاعدة البيانات تمنع تكرار البريد وتثبت حدود المقاعد الحساسة", () => {
  const migration = readFileSync(new URL("../migrations/0025_plus_member_entitlements.sql", import.meta.url), "utf8");
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS idx_navixa_members_active_email/);
  assert.match(migration, /role='full_member'.*seat_no=1/);
  assert.match(migration, /role='project_member'.*seat_no=1/);
  assert.match(migration, /role='kid'.*seat_no BETWEEN 1 AND 2/);
});
