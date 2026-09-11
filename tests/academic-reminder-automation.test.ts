import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  listAcademicReminderAutomationRuns,
  saveReviewedAcademicReminder,
} from "../app/academicReminderAutomation.ts";
import { readAcademicReminders } from "../app/academicReminders.ts";

const root = new URL("../", import.meta.url);

function withBrowserStorage() {
  const values = new Map<string, string>();
  const events: string[] = [];
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: (event: Event) => events.push(event.type),
    },
  });
  return {
    values,
    events,
    restore() {
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    },
  };
}

test("reviewed academic reminder is saved by the automation skill without putting title/date in run history", async () => {
  const browser = withBrowserStorage();
  const originalFetch = globalThis.fetch;
  const persistedBodies: string[] = [];
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    persistedBodies.push(String(init?.body || ""));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const reminder = await saveReviewedAcademicReminder({ title: "  ميد   الشبكات  ", date: "2026-10-12" });
    assert.equal(reminder.title, "ميد الشبكات");
    assert.equal(reminder.date, "2026-10-12");
    assert.equal(reminder.alertDate, "2026-10-11");
    assert.equal(readAcademicReminders()[0]?.title, "ميد الشبكات");
    assert.deepEqual(browser.events, ["navixa:academic-reminder"]);

    const runs = await listAcademicReminderAutomationRuns();
    const run = runs.at(-1);
    assert.equal(run?.status, "succeeded");
    assert.equal(run?.skillId, "academic.reminder.local");
    assert.equal(run?.trigger.type, "manual");
    const localRun = JSON.stringify(run);
    assert.equal(localRun.includes("ميد الشبكات"), false);
    assert.equal(localRun.includes("2026-10-12"), false);

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(persistedBodies.length, 1);
    assert.equal(persistedBodies[0]?.includes("ميد الشبكات"), false);
    assert.equal(persistedBodies[0]?.includes("2026-10-12"), false);
    const persisted = JSON.parse(persistedBodies[0] || "{}") as Record<string, unknown>;
    assert.equal(persisted.skillId, "academic.reminder.local");
    assert.equal(persisted.status, "succeeded");
    assert.equal(persisted.source, "manual");
  } finally {
    globalThis.fetch = originalFetch;
    browser.restore();
  }
});

test("persistent history network failure does not block local academic reminder save", async () => {
  const browser = withBrowserStorage();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Promise.reject(new Error("offline"))) as typeof fetch;

  try {
    const reminder = await saveReviewedAcademicReminder({ title: "كويز قواعد البيانات", date: "2026-11-05" });
    assert.equal(reminder.title, "كويز قواعد البيانات");
    assert.equal(readAcademicReminders()[0]?.date, "2026-11-05");
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    globalThis.fetch = originalFetch;
    browser.restore();
  }
});

test("invalid reviewed academic reminder is rejected before local storage changes", async () => {
  const browser = withBrowserStorage();
  try {
    await assert.rejects(
      saveReviewedAcademicReminder({ title: "اختبار", date: "2026-02-31" }),
      /date is invalid/,
    );
    assert.deepEqual(readAcademicReminders(), []);
  } finally {
    browser.restore();
  }
});

test("MeetingStudio routes approved reminders through the automation adapter", async () => {
  const studio = await readFile(new URL("app/meetings/MeetingStudio.tsx", root), "utf8");
  assert.match(studio, /import \{ saveReviewedAcademicReminder \} from "\.\.\/academicReminderAutomation"/);
  assert.match(studio, /const acceptAcademicSuggestion = async/);
  assert.match(studio, /await saveReviewedAcademicReminder\(\{ title, date \}\)/);
  assert.match(studio, /onClick=\{\(\) => void acceptAcademicSuggestion\(suggestion\)\}/);
  assert.doesNotMatch(studio, /import \{ saveAcademicReminder \} from "\.\.\/academicReminders"/);
});
