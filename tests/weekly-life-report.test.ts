import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildWeeklyLifeReport,
  localDateKey,
  movementTrackingKey,
  prayerTrackingKey,
  readPrayerCompletions,
  readWeeklyLifeDay,
  waterTrackingKey,
} from "../app/weeklyLifeReport.ts";

test("daily tracking uses the device calendar date instead of a UTC slice", () => {
  const localMidnight = new Date(2026, 8, 13, 0, 30, 0);
  assert.equal(localDateKey(0, localMidnight), "2026-09-13");
  assert.equal(localDateKey(-1, localMidnight), "2026-09-12");
});

test("personal reminder daily keys share the local calendar helper", () => {
  const root = new URL("../", import.meta.url);
  const helper = fs.readFileSync(new URL("app/localDate.ts", root), "utf8");
  const reminders = fs.readFileSync(new URL("app/PersonalReminderEngine.tsx", root), "utf8");
  assert.match(helper, /getFullYear\(\)/);
  assert.match(helper, /getMonth\(\)/);
  assert.match(helper, /getDate\(\)/);
  assert.doesNotMatch(helper, /toISOString/);
  assert.match(reminders, /import \{localDateKey\} from "\.\/localDate"/);
  assert.match(reminders, /dayKey=localDateKey\(\)/);
  assert.match(reminders, /navixa-water-\$\{dayKey\}-last/);
  assert.match(reminders, /item\.alertDate<=dayKey&&item\.date>=dayKey/);
  assert.doesNotMatch(reminders, /toISOString\(\)\.slice\(0,10\)/);
});

test("prayer tracking keeps only the five supported prayers", () => {
  assert.deepEqual(readPrayerCompletions('["Fajr","Asr","Unknown","Fajr"]'), ["Fajr", "Asr"]);
  assert.deepEqual(readPrayerCompletions("broken"), []);
  assert.deepEqual(readPrayerCompletions(null), []);
});

test("daily life data distinguishes missing records from real zero values", () => {
  const values = new Map<string, string>([
    [prayerTrackingKey("2026-09-13"), "[]"],
    [waterTrackingKey("2026-09-13"), "0"],
    ["navixa-sitting-2026-09-13", "1200"],
  ]);
  const day = readWeeklyLifeDay((key) => values.get(key) ?? null, "2026-09-13");
  assert.equal(day.prayers, 0);
  assert.equal(day.waterCups, 0);
  assert.equal(day.movementSessions, 0);

  const missing = readWeeklyLifeDay(() => null, "2026-09-12");
  assert.equal(missing.prayers, null);
  assert.equal(missing.waterCups, null);
  assert.equal(missing.movementSessions, null);
});

test("weekly report aggregates only days that were actually recorded", () => {
  const report = buildWeeklyLifeReport([
    { date: "d1", prayers: 5, waterCups: 8, movementSessions: 2 },
    { date: "d2", prayers: 3, waterCups: 4, movementSessions: 0 },
    { date: "d3", prayers: null, waterCups: null, movementSessions: null },
  ]);
  assert.equal(report.prayerCompleted, 8);
  assert.equal(report.prayerPossible, 10);
  assert.equal(report.prayerPercent, 80);
  assert.equal(report.prayerRecordedDays, 2);
  assert.equal(report.waterAverage, 6);
  assert.equal(report.waterGoalDays, 1);
  assert.equal(report.waterRecordedDays, 2);
  assert.equal(report.movementSessions, 2);
  assert.equal(report.movementActiveDays, 1);
  assert.equal(report.movementRecordedDays, 2);
});

test("worship, health, and progress pages are wired to the same weekly data model", () => {
  const root = new URL("../", import.meta.url);
  const worship = fs.readFileSync(new URL("app/WorshipCenter.tsx", root), "utf8");
  const health = fs.readFileSync(new URL("app/HealthMonitor.tsx", root), "utf8");
  const progress = fs.readFileSync(new URL("app/progress/page.tsx", root), "utf8");
  assert.match(worship, /prayerTrackingKey/);
  assert.match(worship, /localDateKey/);
  assert.match(worship, /سجّل الصلاة/);
  assert.match(health, /movementTrackingKey/);
  assert.match(health, /localDateKey/);
  assert.match(health, /completeMovement\(\)/);
  assert.match(progress, /buildWeeklyLifeReport/);
  assert.match(progress, /localDateKey/);
  assert.match(progress, /الصلاة · الماء · الحركة/);
  assert.match(progress, /لا توجد تسجيلات بعد/);
  assert.equal(movementTrackingKey("2026-09-13"), "navixa-movement-2026-09-13");
});
