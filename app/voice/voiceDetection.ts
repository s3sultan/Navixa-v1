export type NavixaVoiceMatchMethod = "exact" | "fuzzy" | "phonetic";

export type NavixaVoiceMatch = {
  term: string;
  normalizedTerm: string;
  candidate: string;
  method: NavixaVoiceMatchMethod;
  score: number;
};

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;
const TATWEEL = /\u0640/g;
const NON_WORD = /[^\p{L}\p{N}]+/gu;
const LATIN = /[a-z]/;
const ARABIC = /[\u0600-\u06FF]/;

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
    .replace(/[گڨ]/g, "ك")
    .replace(/چ/g, "ج")
    .replace(/پ/g, "ب")
    .replace(/ڤ/g, "ف")
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

export function buildNavixaVoiceBiasPhrases(value: string): string[] {
  const seen = new Set<string>();
  const phrases: string[] = [];
  const add = (phrase: string) => {
    const clean = phrase.replace(/\s+/g, " ").trim();
    const key = normalizeNavixaVoiceText(clean);
    if (!clean || !key || seen.has(key)) return;
    seen.add(key);
    phrases.push(clean);
  };

  for (const chunk of value.split(/[،,;؛.!؟:|/\\\n]+/)) {
    const clean = chunk.trim();
    if (!clean) continue;
    add(clean);
    for (const token of clean.split(/\s+/)) add(token);
  }
  return phrases.slice(0, 24);
}

const latinPhoneticSkeleton = (value: string): string => value
  .replace(/sh/g, "x")
  .replace(/ch/g, "x")
  .replace(/th/g, "s")
  .replace(/kh/g, "h")
  .replace(/gh/g, "k")
  .replace(/ph/g, "f")
  .replace(/[aeiouy]/g, "")
  .replace(/[pb]/g, "b")
  .replace(/[dt]/g, "t")
  .replace(/[ckqg]/g, "k")
  .replace(/[vf]/g, "f")
  .replace(/[zs]/g, "s")
  .replace(/[^a-z0-9]/g, "")
  .replace(/(.)\1+/g, "$1");

// Some non-native English accents add a light aspiration after stop consonants
// (for example, "Sulthan" for "Sultan"). Keep this as an alternate skeleton,
// not the primary one, so normal English digraphs remain conservative.
const latinAspiratedSkeleton = (value: string): string => latinPhoneticSkeleton(
  value.replace(/([bdgkpt])h/g, "$1"),
);

const arabicPhoneticSkeleton = (value: string): string => value
  .replace(/[اويء]/g, "")
  .replace(/[بپ]/g, "b")
  .replace(/[تطدض]/g, "t")
  .replace(/[ثسصزذظ]/g, "s")
  .replace(/[جچقكگڨغ]/g, "k")
  .replace(/[حخهع]/g, "h")
  .replace(/ش/g, "x")
  .replace(/[فڤ]/g, "f")
  .replace(/ر/g, "r")
  .replace(/ل/g, "l")
  .replace(/م/g, "m")
  .replace(/ن/g, "n")
  .replace(/[^a-z0-9]/g, "")
  .replace(/(.)\1+/g, "$1");

const phoneticSkeletons = (value: string): string[] => {
  const normalized = normalizeNavixaVoiceText(value).replace(/\s+/g, "");
  if (!normalized) return [];
  if (!LATIN.test(normalized)) return [arabicPhoneticSkeleton(normalized)].filter(Boolean);
  const skeletons = [latinPhoneticSkeleton(normalized), latinAspiratedSkeleton(normalized)];
  return [...new Set(skeletons.filter(Boolean))];
};

export function navixaVoicePhoneticSkeleton(value: string): string {
  return phoneticSkeletons(value)[0] || "";
}

const editDistance = (left: string, right: string): number => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
  }
  return previous[right.length];
};

const safeFuzzyLatinScore = (candidate: string, term: string): number | null => {
  const compactCandidate = candidate.replace(/\s+/g, "");
  const compactTerm = term.replace(/\s+/g, "");
  if (!LATIN.test(compactTerm) || compactTerm.length < 5 || compactCandidate.length < 4) return null;
  if (compactCandidate[0] !== compactTerm[0]) return null;
  const allowance = compactTerm.length >= 9 ? 2 : 1;
  if (Math.abs(compactCandidate.length - compactTerm.length) > allowance) return null;
  const distance = editDistance(compactCandidate, compactTerm);
  if (distance > allowance) return null;
  return Math.max(0.82, 1 - distance / Math.max(compactCandidate.length, compactTerm.length));
};

const candidateWindows = (tokens: string[]): string[] => {
  const windows: string[] = [];
  for (let start = 0; start < tokens.length; start += 1) {
    for (let size = 1; size <= 3 && start + size <= tokens.length; size += 1) {
      windows.push(tokens.slice(start, start + size).join(" "));
    }
  }
  return windows;
};

const crossScriptLongVowelsCompatible = (candidate: string, term: string): boolean => {
  const compactCandidate = candidate.replace(/\s+/g, "");
  const compactTerm = term.replace(/\s+/g, "");
  const candidateLatin = LATIN.test(compactCandidate);
  const termLatin = LATIN.test(compactTerm);
  const candidateArabic = ARABIC.test(compactCandidate);
  const termArabic = ARABIC.test(compactTerm);
  if (!((candidateLatin && termArabic) || (candidateArabic && termLatin))) return true;

  const latin = candidateLatin ? compactCandidate : compactTerm;
  const arabic = candidateArabic ? compactCandidate : compactTerm;

  // Long Latin vowel spellings normally correspond to an explicit Arabic long-vowel letter.
  // This rejects collisions such as محمود/Mahmoud being mistaken for محمد/Mohammed,
  // while keeping short-vowel transliterations such as Mohamed/Mohammad/Muhammed valid.
  if (/(?:ou|oo)/.test(latin) && !arabic.includes("و")) return false;
  if (/(?:ee|ii)/.test(latin) && !arabic.includes("ي")) return false;
  if (/aa/.test(latin) && !arabic.includes("ا")) return false;
  return true;
};

const scriptsCompatibleForPhoneticMatch = (candidate: string, term: string): boolean => {
  const compactCandidate = candidate.replace(/\s+/g, "");
  const compactTerm = term.replace(/\s+/g, "");
  const candidateLatin = LATIN.test(compactCandidate);
  const termLatin = LATIN.test(compactTerm);
  const candidateArabic = ARABIC.test(compactCandidate);
  const termArabic = ARABIC.test(compactTerm);

  // Cross-script Arabic/Latin matching is intentional for names such as محمد/Mohammed,
  // but long-vowel evidence must not contradict the Arabic spelling.
  if ((candidateLatin && termArabic) || (candidateArabic && termLatin)) {
    return crossScriptLongVowelsCompatible(candidate, term);
  }

  // Same-script Latin phonetic matching stays conservative: do not let broad
  // consonant grouping turn a different initial into a name alert.
  if (candidateLatin && termLatin) return compactCandidate[0] === compactTerm[0];
  return true;
};

export function findNavixaVoiceTerm(text: string, terms: string[]): NavixaVoiceMatch | null {
  const normalizedText = normalizeNavixaVoiceText(text);
  if (!normalizedText) return null;
  const textTokens = normalizedText.split(" ").filter(Boolean);
  const tokens = new Set(textTokens);
  const windows = candidateWindows(textTokens);

  for (const rawTerm of terms) {
    const normalizedTerm = normalizeNavixaVoiceText(rawTerm);
    if (!normalizedTerm) continue;
    if (normalizedTerm.includes(" ")) {
      const paddedText = ` ${normalizedText} `;
      if (paddedText.includes(` ${normalizedTerm} `)) {
        return { term: rawTerm, normalizedTerm, candidate: normalizedTerm, method: "exact", score: 1 };
      }
    } else if (tokens.has(normalizedTerm)) {
      return { term: rawTerm, normalizedTerm, candidate: normalizedTerm, method: "exact", score: 1 };
    }

    const termSkeletons = phoneticSkeletons(normalizedTerm);
    for (const candidate of windows) {
      const fuzzyScore = safeFuzzyLatinScore(candidate, normalizedTerm);
      if (fuzzyScore !== null) {
        return { term: rawTerm, normalizedTerm, candidate, method: "fuzzy", score: fuzzyScore };
      }
      if (!scriptsCompatibleForPhoneticMatch(candidate, normalizedTerm)) continue;
      const candidateSkeletons = phoneticSkeletons(candidate);
      const sharedSkeleton = termSkeletons.find((skeleton) => skeleton.length >= 4 && candidateSkeletons.includes(skeleton));
      if (sharedSkeleton) {
        return { term: rawTerm, normalizedTerm, candidate, method: "phonetic", score: 0.9 };
      }
    }
  }
  return null;
}
