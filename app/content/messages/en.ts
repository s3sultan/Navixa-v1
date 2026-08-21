// NAVIXA dynamic messages — English
// Use these templates only with real, validated runtime data.

export const enMessages = {
  smartListening: {
    detectedName: (name: string) => `Heard ${name}`,
  },
  tasks: {
    overdue: (count: number) => `You have ${count} overdue tasks`,
    needsAttention: (count: number) => `${count} tasks need your attention`,
    completedOfTotal: (completed: number, total: number) => `${completed} / ${total}`,
  },
  health: {
    sittingTooLong: (hours: number) => `You have been sitting for ${hours} hours without moving`,
    hydrationProgress: (cups: number, goal: number) => `${cups}/${goal}`,
    hydrationDays: (days: number) => `${days} hydration days`,
  },
  prayer: {
    remainingMinutes: (minutes: number) => `${minutes} minutes until prayer`,
  },
  focus: {
    durationMinutes: (minutes: number) => `${minutes} minutes`,
    readyForMinutes: (minutes: number) => `Ready for ${minutes} minutes`,
  },
  matches: {
    matchCountForDate: (count: number, date: string) => `${count} matches on ${date}`,
  },
} as const;
