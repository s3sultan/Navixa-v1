// رسائل NAVIXA الديناميكية — العربية
// استخدم هذه القوالب فقط عند تمرير بيانات حقيقية ومتحقق منها.

export const arMessages = {
  smartListening: {
    detectedName: (name: string) => `تم سماع ${name}`,
  },
  tasks: {
    overdue: (count: number) => `لديك ${count} مهام متأخرة`,
    needsAttention: (count: number) => `${count} مهام تحتاج انتباهك`,
    completedOfTotal: (completed: number, total: number) => `${completed} / ${total}`,
  },
  health: {
    sittingTooLong: (hours: number) => `جلست ${hours} ساعات دون حركة`,
    hydrationProgress: (cups: number, goal: number) => `${cups}/${goal}`,
    hydrationDays: (days: number) => `${days} أيام ترطيب`,
  },
  prayer: {
    remainingMinutes: (minutes: number) => `باقي ${minutes} دقيقة على الصلاة`,
  },
  focus: {
    durationMinutes: (minutes: number) => `${minutes} دقيقة`,
    readyForMinutes: (minutes: number) => `جاهز لـ ${minutes} دقيقة`,
  },
  matches: {
    matchCountForDate: (count: number, date: string) => `${count} مباراة في ${date}`,
  },
} as const;
