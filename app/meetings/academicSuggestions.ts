export type AcademicSuggestion = { id: string; title: string; date: string; evidence: string };

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

const academicTerms = /(كويز|quiz|ميد|mid(?:term)?|اختبار|presentation|عرض)/i;
const datePattern = /(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/;

export function academicSuggestions(text: string, currentYear = new Date().getFullYear()): AcademicSuggestion[] {
  const normalized = normalizeDigits(text).replace(/\s+/g, " ").trim();
  const parts = normalized.split(/[.!؟\n،]|\bثم\b|\band then\b/i).map((part) => part.trim()).filter(Boolean);
  const found: AcademicSuggestion[] = [];
  for (const part of parts) {
    if (!academicTerms.test(part)) continue;
    const match = datePattern.exec(part);
    if (!match) continue;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const suppliedYear = Number(match[3] || 0);
    const year = suppliedYear >= 2024 && suppliedYear <= 2100 ? suppliedYear : currentYear;
    if (!day || day > 31 || !month || month > 12) continue;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const evidence = part.slice(0, 180);
    found.push({ id: `${date}-${evidence}`.slice(0, 180), title: evidence.slice(0, 110), date, evidence });
  }
  return found.filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index).slice(0, 5);
}
