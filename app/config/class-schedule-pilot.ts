export type ClassScheduleItem = {
  code: string;
  name: string;
  days: readonly number[];
  start: string;
  end: string;
};

export const CLASS_SCHEDULE_TIMEZONE = "Asia/Riyadh";
export const CLASS_SCHEDULE_REMINDERS = [60, 30, 10] as const;

// Weekly lectures stop recurring before the university final-exam period begins.
// 2026-12-12 23:59:59 Asia/Riyadh = 2026-12-12 20:59:59 UTC.
export const CLASS_SCHEDULE_RECURRENCE_UNTIL_UTC = "20261212T205959Z";
export const CLASS_SCHEDULE_LAST_LECTURE_DATE = "2026-12-12";

export const CLASS_SCHEDULE_CLASSES: readonly ClassScheduleItem[] = [
  { code: "101", name: "الفيزياء العامة 1", days: [0, 2], start: "15:00", end: "15:50" },
  { code: "232", name: "البرمجة كائنية التوجه", days: [1, 3], start: "16:00", end: "16:50" },
  { code: "231", name: "مقدمة في تقنية ونظم المعلومات", days: [0, 3], start: "17:00", end: "17:50" },
  { code: "150", name: "الرياضيات المتقطعة", days: [1, 3], start: "18:00", end: "18:50" },
  { code: "233", name: "تنظيم الحاسب", days: [1, 3], start: "19:00", end: "19:50" },
];
