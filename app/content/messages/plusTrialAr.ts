// رسائل تجربة NAVIXA هِمّة — العربية
// لا تُرسل الرسائل إلا عند توفر حساب فعلي وموافقة المستخدم على القناة.
// الأرقام والإحصاءات تُمرر من بيانات حقيقية، ولا تُكتب داخل القالب.

type TrialData = {
  name: string;
  trialEndsAt?: string;
  tasksCompleted?: number;
  healthDays?: number;
  matchesFollowed?: number;
  focusMinutes?: number;
};

const hello = (name: string) => name.trim() || "مرحبًا";

export const plusTrialEmails = {
  day0: {
    subject: "مرحبًا بك في NAVIXA هِمّة",
    body: (data: TrialData) => `مرحبًا ${hello(data.name)},\n\nبدأت تجربتك المجانية في NAVIXA هِمّة. خذ دقيقة واحدة لإضافة أول مهمة أو عادة أو تنبيه يناسب يومك.\n\nالتجربة مصممة لتكتشف ما يفيدك بهدوء، ويمكنك إيقاف الرسائل من إعدادات الحساب في أي وقت.\n\nمع التقدير،\nNAVIXA SA`,
  },
  day1: {
    subject: "خطوة صغيرة لتنظيم يومك",
    body: (data: TrialData) => `مرحبًا ${hello(data.name)},\n\nابدأ بخطوة واحدة اليوم: أضف مهمة، حدّد تذكيرًا، أو جرّب إحدى أدوات NAVIXA المحلية.\n\nلا تحتاج إلى إعداد طويل؛ اختر ما يناسبك واترك الباقي لوقت لاحق.\n\nNAVIXA SA`,
  },
  day3: {
    subject: "ملخص تجربتك حتى الآن",
    body: (data: TrialData) => `مرحبًا ${hello(data.name)},\n\nهذا ملخص ما ظهر في حسابك حتى الآن:\n${data.tasksCompleted == null ? "• لم تُسجّل مهام كافية لعرض رقم بعد" : `• مهام منجزة: ${data.tasksCompleted}`}\n${data.healthDays == null ? "• لا توجد بيانات صحية كافية بعد" : `• أيام متابعة صحية: ${data.healthDays}`}\n\nهذه الأرقام تخص حسابك فقط، وتُعرض عندما تكون البيانات متاحة فعلًا.\n\nNAVIXA SA`,
  },
  day7: {
    subject: "أسبوع من التجربة — ماذا يناسبك؟",
    body: (data: TrialData) => `مرحبًا ${hello(data.name)},\n\nمرّ أسبوع على تجربتك في NAVIXA هِمّة. راجع الأدوات التي استخدمتها، واحتفظ بما يخدم يومك فقط.\n\nيمكنك الآن الاطلاع على مزايا هِمّة مثل الملخصات، التحليلات، والتنبيهات المتقدمة قبل انتهاء التجربة.\n\nNAVIXA SA`,
  },
  day10: {
    subject: "باقي أربعة أيام على تجربة هِمّة",
    body: (data: TrialData) => `مرحبًا ${hello(data.name)},\n\nتبقى أربعة أيام على تجربتك المجانية${data.trialEndsAt ? `، وتنتهي في ${data.trialEndsAt}` : ""}.\n\nبعد انتهاء التجربة ستبقى بياناتك الأساسية محفوظة، ويمكنك الاستمرار في استخدام المزايا المجانية. مزايا هِمّة فقط ستتوقف حتى تختار الاشتراك.\n\nيمكنك مراجعة التفاصيل من صفحة الاشتراك دون أي التزام.\n\nNAVIXA SA`,
  },
  day12: {
    subject: "تجربتك في NAVIXA هِمّة تقترب من النهاية",
    body: (data: TrialData) => `مرحبًا ${hello(data.name)},\n\nتبقى يومان تقريبًا على نهاية التجربة${data.trialEndsAt ? `، وتنتهي في ${data.trialEndsAt}` : ""}.\n\nإذا كانت أدوات هِمّة مفيدة لك، يمكنك تفعيل الاشتراك من صفحة هِمّة. وإذا لم يكن الوقت مناسبًا، لا تحتاج إلى فعل أي شيء؛ ستبقى بياناتك الأساسية معك.\n\nNAVIXA SA`,
  },
  day14: {
    subject: "انتهت تجربة NAVIXA هِمّة",
    body: (data: TrialData) => `مرحبًا ${hello(data.name)},\n\nانتهت فترة التجربة المجانية في NAVIXA هِمّة. لم تُحذف بياناتك، وتبقى المزايا الأساسية متاحة لك.\n\nيمكنك العودة إلى هِمّة متى رغبت، بعد مراجعة الباقات والأسعار بوضوح من صفحة الاشتراك.\n\nشكرًا لتجربتك،\nNAVIXA SA`,
  },
} as const;

export const plusTrialTelegram = {
  day0: (data: TrialData) => `مرحبًا ${hello(data.name)}، بدأت تجربتك المجانية في NAVIXA هِمّة. افتح التطبيق واختر أول خطوة تناسب يومك.`,
  day7: (data: TrialData) => `ملخص أسبوعك في NAVIXA هِمّة جاهز يا ${hello(data.name)}. راجع ما استخدمته واحتفظ بما يفيدك.`,
  day10: (data: TrialData) => `تبقى أربعة أيام على تجربة NAVIXA هِمّة${data.trialEndsAt ? ` وتنتهي في ${data.trialEndsAt}` : ""}. راجع المزايا والأسعار من داخل التطبيق.`,
  day14: (data: TrialData) => `انتهت تجربة NAVIXA هِمّة. بياناتك الأساسية محفوظة، ويمكنك العودة إلى المزايا المدفوعة متى رغبت.`,
  adminAnnouncement: (message: string) => `إعلان من NAVIXA SA\n\n${message.trim()}`,
} as const;

export type PlusTrialEmailKey = keyof typeof plusTrialEmails;
