import assert from "node:assert/strict";
import test from "node:test";
import { readAcademicReminders, saveAcademicReminder } from "../app/academicReminders.ts";

test("academic reminder persists the reviewed title, date, and one-day local alert", () => {
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

  try {
    const reminder = saveAcademicReminder({ title: "ميد المحاضرة الرابعة", date: "2026-06-25" });
    assert.equal(reminder.title, "ميد المحاضرة الرابعة");
    assert.equal(reminder.date, "2026-06-25");
    assert.equal(reminder.alertDate, "2026-06-24");
    assert.equal(readAcademicReminders()[0]?.title, "ميد المحاضرة الرابعة");
    assert.deepEqual(events, ["navixa:academic-reminder"]);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});
