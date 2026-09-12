export type AcademicReminder = { id: string; title: string; date: string; alertDate: string; createdAt: string; source: "meeting" };

const STORAGE_KEY = "navixa-academic-reminders";

export function readAcademicReminders(): AcademicReminder[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item): item is AcademicReminder => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.date === "string") : [];
  } catch { return []; }
}

async function syncAcademicPush(reminder:AcademicReminder){
  const eventDate=new Date(`${reminder.date}T18:00:00+03:00`);
  const due=new Date(eventDate.getTime()-24*60*60*1000);
  if(!Number.isFinite(due.getTime())||due.getTime()<=Date.now())return;
  try{
    await fetch("/api/reminders",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      credentials:"same-origin",
      body:JSON.stringify({
        title:`${reminder.title} (${reminder.date})`,
        dueAt:due.toISOString(),
        push:true,
        email:false,
        telegram:false,
        source:"schedule",
      }),
    });
  }catch{/* Local schedule remains available if server sync is temporarily unavailable. */}
}

export function saveAcademicReminder(input: Omit<AcademicReminder, "id" | "createdAt" | "alertDate" | "source">): AcademicReminder {
  const eventDate = new Date(`${input.date}T18:00:00+03:00`);
  const alert = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  const reminder: AcademicReminder = { id: `academic-${input.date}-${input.title}`.slice(0, 180), title: input.title, date: input.date, alertDate: alert.toISOString().slice(0, 10), createdAt: new Date().toISOString(), source: "meeting" };
  const existing = readAcademicReminders().filter((item) => item.id !== reminder.id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, reminder]));
  window.dispatchEvent(new CustomEvent("navixa:academic-reminder", { detail: reminder }));
  void syncAcademicPush(reminder);
  return reminder;
}
