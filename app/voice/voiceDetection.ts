export type NavixaVoiceMatch = {
  term: string;
  normalizedTerm: string;
};

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;
const TATWEEL = /\u0640/g;
const NON_WORD = /[^\p{L}\p{N}]+/gu;

export function normalizeNavixaVoiceText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(NON_WORD, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function splitNavixaVoiceTerms(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[،,;؛.!؟:|/\\\n]+/)
    .flatMap((part) => part.trim().split(/\s+/))
    .map(normalizeNavixaVoiceText)
    .filter((term) => {
      if (!term || seen.has(term)) return false;
      seen.add(term);
      return true;
    });
}

export function findNavixaVoiceTerm(text: string, terms: string[]): NavixaVoiceMatch | null {
  const normalizedText = normalizeNavixaVoiceText(text);
  if (!normalizedText) return null;
  const tokens = new Set(normalizedText.split(" ").filter(Boolean));

  for (const rawTerm of terms) {
    const normalizedTerm = normalizeNavixaVoiceText(rawTerm);
    if (!normalizedTerm) continue;
    if (normalizedTerm.includes(" ")) {
      const paddedText = ` ${normalizedText} `;
      if (paddedText.includes(` ${normalizedTerm} `)) return { term: rawTerm, normalizedTerm };
      continue;
    }
    if (tokens.has(normalizedTerm)) return { term: rawTerm, normalizedTerm };
  }
  return null;
}
