export type CopyCategory =
  | "marketing"
  | "ui"
  | "notification"
  | "dynamic"
  | "privacy"
  | "subscription"
  | "error"
  | "success";

export type CopyCatalogEntry = {
  category: CopyCategory;
  description: string;
  source: string;
};

// معرفات مستقرة للمراجعة. النصوص نفسها تبقى في ar.ts / en.ts / cta / messages.
export const copyCatalog: Record<string, CopyCatalogEntry> = {
  "navixa.tagline": { category: "marketing", description: "الشعار النصي للعلامة", source: "ar.navixa.tagline" },
  "home.welcome.title": { category: "marketing", description: "عنوان لوحة الترحيب", source: "ar.home.welcome" },
  "home.today.title": { category: "ui", description: "عنوان قسم اليوم", source: "ar.home.today.title" },
  "tasks.label": { category: "ui", description: "تسمية المهام", source: "ar.tasks.label" },
  "tasks.overdue": { category: "dynamic", description: "عدد المهام المتأخرة من بيانات المستخدم", source: "arMessages.tasks.overdue" },
  "notifications.label": { category: "notification", description: "تسمية التنبيهات", source: "ar.notifications.label" },
  "smartListening.title": { category: "ui", description: "عنوان ميزة سماع نداء الاسم", source: "ar.smartListening.readyTitle" },
  "smartListening.detectedName": { category: "dynamic", description: "إشعار الاسم المسموع من حدث حقيقي", source: "arMessages.smartListening.detectedName" },
  "screenMonitoring.title": { category: "ui", description: "عنوان ميزة متابعة الشاشة", source: "ar.screenMonitoring.title" },
  "productivity.focus": { category: "ui", description: "تسمية جلسة التركيز", source: "ar.productivity.focus" },
  "health.sittingTooLong": { category: "dynamic", description: "تنبيه مدة الجلوس من قياس حقيقي", source: "arMessages.health.sittingTooLong" },
  "water.progress": { category: "dynamic", description: "تقدم الماء من سجل المستخدم", source: "arMessages.health.hydrationProgress" },
  "worship.label": { category: "ui", description: "تسمية قسم العبادة", source: "ar.worship.label" },
  "prayer.remaining": { category: "dynamic", description: "الوقت المتبقي للصلاة", source: "arMessages.prayer.remainingMinutes" },
  "assistant.label": { category: "ui", description: "تسمية المساعد", source: "ar.assistant.label" },
  "meetings.title": { category: "ui", description: "عنوان تلخيص الاجتماعات", source: "ar.meetings.title" },
  "plus.heroTitle": { category: "subscription", description: "عنوان Plus الرئيسي", source: "ar.plus" },
  "plus.trial": { category: "subscription", description: "وعد تجربة Plus", source: "ar.plus.trialTrust" },
  "privacy.title": { category: "privacy", description: "عنوان وعد الخصوصية", source: "ar.privacy.title" },
  "privacy.description": { category: "privacy", description: "شرح الخصوصية الأساسي", source: "ar.privacy.description" },
  "cta.startNow": { category: "ui", description: "زر البدء الموحد", source: "arCta.startNow" },
  "cta.watchTutorial": { category: "ui", description: "زر مشاهدة الشرح", source: "arCta.watchTutorial" },
  "account.passwordless": { category: "privacy", description: "وعد دخول الحساب بلا كلمة مرور", source: "ar.account" },
};
