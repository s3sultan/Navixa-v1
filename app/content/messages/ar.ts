// رسائل NAVIXA الديناميكية — العربية
// استخدم هذه القوالب فقط عند تمرير بيانات حقيقية ومتحقق منها.

export const arMessages = {
  smartListening: {
    detectedName: (name: string) => `تم رصد ${name}`,
  },
  tasks: {
    overdue: (count: number) => `لديك ${count} مهام تحتاج مراجعة`,
    needsAttention: (count: number) => `${count} مهام بانتظارك`,
    completedOfTotal: (completed: number, total: number) => `${completed} / ${total}`,
  },
  health: {
    sittingTooLong: (hours: number) => `مضى ${hours} ساعات من دون حركة`,
    hydrationProgress: (cups: number, goal: number) => `${cups}/${goal}`,
    hydrationDays: (days: number) => `${days} أيام ترطيب`,
  },
  prayer: {
    remainingMinutes: (minutes: number) => `يتبقى ${minutes} دقيقة على الصلاة`,
  },
  focus: {
    durationMinutes: (minutes: number) => `${minutes} دقيقة`,
    readyForMinutes: (minutes: number) => `جاهز لـ ${minutes} دقيقة`,
  },
  matches: {
    matchCountForDate: (count: number, date: string) => `${count} مباراة في ${date}`,
  },
} as const;
