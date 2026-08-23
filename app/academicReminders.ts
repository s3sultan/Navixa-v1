export type AcademicReminder = { id: string; title: string; date: string; alertDate: string; createdAt: string; source: "meeting" };

const STORAGE_KEY = "navixa-academic-reminders";

export function readAcademicReminders(): AcademicReminder[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item): item is AcademicReminder => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.date === "string") : [];
  } catch { return []; }
}

export function saveAcademicReminder(input: Omit<AcademicReminder, "id" | "createdAt" | "alertDate" | "source">): AcademicReminder {
  const eventDate = new Date(`${input.date}T18:00:00+03:00`);
  const alert = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  const reminder: AcademicReminder = { id: `academic-${input.date}-${input.title}`.slice(0, 180), title: input.title, date: input.date, alertDate: alert.toISOString().slice(0, 10), createdAt: new Date().toISOString(), source: "meeting" };
  const existing = readAcademicReminders().filter((item) => item.id !== reminder.id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, reminder]));
  window.dispatchEvent(new CustomEvent("navixa:academic-reminder", { detail: reminder }));
  return reminder;
}
