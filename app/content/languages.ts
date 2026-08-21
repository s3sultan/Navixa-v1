export type NavixaLanguage = "ar" | "en";

export type NavixaLanguageIdentity = {
  code: NavixaLanguage;
  direction: "rtl" | "ltr";
  locale: string;
  arrow: string;
};

// هوية اللغة تحدد اتجاه الواجهة والرموز، وليست ملف نصوص.
export const languageIdentity: Record<NavixaLanguage, NavixaLanguageIdentity> = {
  ar: { code: "ar", direction: "rtl", locale: "ar-SA", arrow: "←" },
  en: { code: "en", direction: "ltr", locale: "en-US", arrow: "→" },
};
