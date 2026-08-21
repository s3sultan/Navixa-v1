export type GlossaryTerm = {
  canonical: string;
  aliases: string[];
  language?: "ar" | "en" | "mixed";
  sourceCount?: number;
};

const STOP_WORDS = new Set(["في","من","على","الى","إلى","عن","هذا","هذه","ذلك","التي","الذي","ثم","مع","كان","كانت","أن","إن","او","أو","لا","ما","فيه","لها","له","كما","بعد","قبل","عند","بين","كل","قد","تم","هو","هي","نحن","أنا","انت","أنت","the","and","that","this","with","from","for","are","was","were","have","has","will","shall","into","about"]);
const PRIVATE_PATTERN = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?966|0)?5\d{8}|https?:\/\/|www\.)/i;

export function normalizeGlossaryTerm(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}+#./ -]/gu, " ").replace(/\s+/g, " ").trim();
}

export function isShareableGlossaryTerm(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length >= 2 && clean.length <= 80 && !PRIVATE_PATTERN.test(clean);
}

export function parseGlossaryInput(input: string): GlossaryTerm[] {
  const terms = new Map<string, GlossaryTerm>();
  for (const rawLine of input.split(/\n+/)) {
    const [rawCanonical, ...rawAliases] = rawLine.split(/\s*(?:—|–|-)\s*/).map((value) => value.trim()).filter(Boolean);
    if (!rawCanonical || !isShareableGlossaryTerm(rawCanonical)) continue;
    const canonical = rawCanonical.slice(0, 80);
    const aliases = rawAliases.flatMap((value) => value.split(/[,،]/)).map((value) => value.trim()).filter((value) => isShareableGlossaryTerm(value) && normalizeGlossaryTerm(value) !== normalizeGlossaryTerm(canonical)).slice(0, 8);
    const key = normalizeGlossaryTerm(canonical);
    const existing = terms.get(key);
    terms.set(key, existing ? { ...existing, aliases: [...new Set([...existing.aliases, ...aliases])].slice(0, 8) } : { canonical, aliases, language: /[\u0600-\u06ff]/.test(canonical) && /[a-z]/i.test(canonical) ? "mixed" : /[\u0600-\u06ff]/.test(canonical) ? "ar" : "en" });
  }
  return [...terms.values()].slice(0, 30);
}

export function mergeGlossaries(...groups: GlossaryTerm[][]) {
  const merged = new Map<string, GlossaryTerm>();
  for (const term of groups.flat()) {
    if (!isShareableGlossaryTerm(term.canonical)) continue;
    const key = normalizeGlossaryTerm(term.canonical);
    const existing = merged.get(key);
    const aliases = [...new Set([...(existing?.aliases || []), ...term.aliases].filter(isShareableGlossaryTerm))].slice(0, 10);
    merged.set(key, { canonical: existing?.canonical || term.canonical, aliases, language: existing?.language || term.language, sourceCount: Math.max(existing?.sourceCount || 0, term.sourceCount || 0) });
  }
  return [...merged.values()].slice(0, 80);
}

function replaceInsensitive(text: string, alias: string, canonical: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try { return text.replace(new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, "giu"), (_, prefix) => `${prefix}${canonical}`); }
  catch { return text; }
}

export function applyGlossary(text: string, terms: GlossaryTerm[]) {
  return terms.reduce((next, term) => term.aliases.sort((a, b) => b.length - a.length).reduce((value, alias) => replaceInsensitive(value, alias, term.canonical), next), text);
}

export function extractFrequentTerms(text: string, maximum = 8) {
  const counts = new Map<string, { canonical: string; count: number }>();
  for (const token of text.match(/[\p{L}][\p{L}\p{N}+#./-]{2,}/gu) || []) {
    const canonical = token.trim();
    const key = normalizeGlossaryTerm(canonical);
    if (!key || STOP_WORDS.has(key) || !isShareableGlossaryTerm(canonical)) continue;
    const current = counts.get(key) || { canonical, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return [...counts.values()].filter((item) => item.count >= 3).sort((a, b) => b.count - a.count || a.canonical.localeCompare(b.canonical)).slice(0, maximum).map((item) => ({ canonical: item.canonical, aliases: [], sourceCount: item.count }));
}

export function detectSingleWordCorrection(before: string, after: string) {
  const left = before.match(/[\p{L}\p{N}+#./-]+/gu) || [];
  const right = after.match(/[\p{L}\p{N}+#./-]+/gu) || [];
  if (left.length !== right.length) return null;
  const changes = left.map((value, index) => ({ from: value, to: right[index] })).filter((item) => normalizeGlossaryTerm(item.from) !== normalizeGlossaryTerm(item.to));
  if (changes.length !== 1 || !isShareableGlossaryTerm(changes[0].from) || !isShareableGlossaryTerm(changes[0].to)) return null;
  return changes[0];
}
