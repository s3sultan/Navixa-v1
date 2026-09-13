export const trackedPrayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export type TrackedPrayer = (typeof trackedPrayers)[number];

export type WeeklyLifeDay = {
  date: string;
  prayers: number | null;
  waterCups: number | null;
  movementSessions: number | null;
};

export type WeeklyLifeReport = {
  prayerCompleted: number;
  prayerPossible: number;
  prayerPercent: number | null;
  prayerRecordedDays: number;
  waterAverage: number | null;
  waterTotal: number;
  waterGoalDays: number;
  waterRecordedDays: number;
  movementSessions: number;
  movementActiveDays: number;
  movementRecordedDays: number;
};

export function localDateKey(offsetDays = 0, base = new Date()) {
  const date = new Date(base);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const prayerTrackingKey = (date: string) => `navixa-prayers-${date}`;
export const movementTrackingKey = (date: string) => `navixa-movement-${date}`;
export const waterTrackingKey = (date: string) => `navixa-water-${date}`;
export const sittingTrackingKey = (date: string) => `navixa-sitting-${date}`;

const safeCount = (value: string | null) => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function readPrayerCompletions(raw: string | null): TrackedPrayer[] {
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return trackedPrayers.filter((name) => parsed.includes(name));
  } catch {
    return [];
  }
}

export function readWeeklyLifeDay(read: (key: string) => string | null, date: string): WeeklyLifeDay {
  const prayerRaw = read(prayerTrackingKey(date));
  const movementRaw = read(movementTrackingKey(date));
  const sittingRaw = read(sittingTrackingKey(date));
  return {
    date,
    prayers: prayerRaw === null ? null : readPrayerCompletions(prayerRaw).length,
    waterCups: safeCount(read(waterTrackingKey(date))),
    movementSessions: movementRaw !== null ? safeCount(movementRaw) : sittingRaw !== null ? 0 : null,
  };
}

export function buildWeeklyLifeReport(days: WeeklyLifeDay[]): WeeklyLifeReport {
  const prayerDays = days.filter((day) => day.prayers !== null);
  const waterDays = days.filter((day) => day.waterCups !== null);
  const movementDays = days.filter((day) => day.movementSessions !== null);

  const prayerCompleted = prayerDays.reduce((sum, day) => sum + (day.prayers ?? 0), 0);
  const prayerPossible = prayerDays.length * trackedPrayers.length;
  const waterTotal = waterDays.reduce((sum, day) => sum + (day.waterCups ?? 0), 0);
  const movementSessions = movementDays.reduce((sum, day) => sum + (day.movementSessions ?? 0), 0);

  return {
    prayerCompleted,
    prayerPossible,
    prayerPercent: prayerPossible ? Math.round((prayerCompleted / prayerPossible) * 100) : null,
    prayerRecordedDays: prayerDays.length,
    waterAverage: waterDays.length ? Math.round((waterTotal / waterDays.length) * 10) / 10 : null,
    waterTotal,
    waterGoalDays: waterDays.filter((day) => (day.waterCups ?? 0) >= 8).length,
    waterRecordedDays: waterDays.length,
    movementSessions,
    movementActiveDays: movementDays.filter((day) => (day.movementSessions ?? 0) > 0).length,
    movementRecordedDays: movementDays.length,
  };
}
