import { findNavixaVoiceTerm, normalizeNavixaVoiceText, splitNavixaVoiceTerms, type NavixaVoiceMatch } from "./voiceDetection.ts";

export type NavixaVoiceAliasSource = "browser" | "local";

type StoredAlias = {
  term: string;
  alias: string;
  hits: number;
  sources: NavixaVoiceAliasSource[];
  firstSeenAt: number;
  lastSeenAt: number;
};

const STORAGE_KEY = "navixa-voice-learned-aliases-v1";
const WATCH_TERMS_KEY = "navixa-watch-terms";
const MAX_ALIASES = 32;
const ALIAS_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const SAME_SOURCE_REPEAT_MS = 20_000;

const storage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
};

const isActive = (entry: StoredAlias) => entry.hits >= 2 || entry.sources.length >= 2;

const isSafeAlias = (match: NavixaVoiceMatch) => {
  if (match.method === "exact") return false;
  const alias = normalizeNavixaVoiceText(match.candidate);
  const compact = alias.replace(/\s+/g, "");
  const tokens = alias.split(" ").filter(Boolean);
  if (!alias || alias === match.normalizedTerm) return false;
  if (tokens.length > 3 || compact.length < 4 || compact.length > 24) return false;
  if (/\d/.test(compact)) return false;
  if (match.method === "fuzzy" && match.score < 0.82) return false;
  if (match.method === "phonetic" && match.score < 0.88) return false;
  return true;
};

const parseEntries = (value: string | null, now: number): StoredAlias[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is StoredAlias => Boolean(
        entry
        && typeof entry.term === "string"
        && typeof entry.alias === "string"
        && Number.isFinite(entry.hits)
        && Array.isArray(entry.sources)
        && Number.isFinite(entry.firstSeenAt)
        && Number.isFinite(entry.lastSeenAt),
      ))
      .map((entry) => ({
        term: normalizeNavixaVoiceText(entry.term),
        alias: normalizeNavixaVoiceText(entry.alias),
        hits: Math.max(1, Math.min(20, Math.round(entry.hits))),
        sources: [...new Set(entry.sources.filter((source): source is NavixaVoiceAliasSource => source === "browser" || source === "local"))],
        firstSeenAt: entry.firstSeenAt,
        lastSeenAt: entry.lastSeenAt,
      }))
      .filter((entry) => entry.term && entry.alias && now - entry.lastSeenAt <= ALIAS_TTL_MS)
      .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
      .slice(0, MAX_ALIASES);
  } catch {
    return [];
  }
};

const readEntries = (now = Date.now()) => parseEntries(storage()?.getItem(STORAGE_KEY) || null, now);

const writeEntries = (entries: StoredAlias[]) => {
  const target = storage();
  if (!target) return;
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ALIASES)));
  } catch {
    // Voice learning is a local optimization. Recognition keeps working if storage is unavailable.
  }
};

export function readNavixaLearnedVoiceAliases(watchTerms: string, now = Date.now()): string[] {
  const watched = new Set(splitNavixaVoiceTerms(watchTerms));
  if (!watched.size) return [];
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const entry of readEntries(now)) {
    if (!watched.has(entry.term) || !isActive(entry) || seen.has(entry.alias)) continue;
    seen.add(entry.alias);
    aliases.push(entry.alias);
  }
  return aliases.slice(0, 16);
}

export function buildNavixaVoiceBiasInput(watchTerms: string, now = Date.now()): string {
  const aliases = readNavixaLearnedVoiceAliases(watchTerms, now);
  return aliases.length ? `${watchTerms}، ${aliases.join("، ")}` : watchTerms;
}

export function rememberNavixaVoiceMatch(match: NavixaVoiceMatch, source: NavixaVoiceAliasSource, now = Date.now()): boolean {
  if (!isSafeAlias(match)) return false;
  const target = storage();
  if (!target) return false;

  const term = normalizeNavixaVoiceText(match.normalizedTerm);
  const alias = normalizeNavixaVoiceText(match.candidate);
  const entries = readEntries(now);
  const index = entries.findIndex((entry) => entry.term === term && entry.alias === alias);
  const previous = index >= 0 ? entries[index] : null;
  const wasActive = Boolean(previous && isActive(previous));

  if (!previous) {
    entries.unshift({ term, alias, hits: 1, sources: [source], firstSeenAt: now, lastSeenAt: now });
  } else {
    const sourceSeen = previous.sources.includes(source);
    const sameSourceTooSoon = sourceSeen && now - previous.lastSeenAt < SAME_SOURCE_REPEAT_MS;
    const updated: StoredAlias = {
      ...previous,
      hits: sameSourceTooSoon ? previous.hits : Math.min(20, previous.hits + 1),
      sources: sourceSeen ? previous.sources : [...previous.sources, source],
      lastSeenAt: now,
    };
    entries.splice(index, 1);
    entries.unshift(updated);
  }

  const cleaned = entries
    .filter((entry) => now - entry.lastSeenAt <= ALIAS_TTL_MS)
    .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
    .slice(0, MAX_ALIASES);
  writeEntries(cleaned);
  const current = cleaned.find((entry) => entry.term === term && entry.alias === alias);
  return Boolean(current && !wasActive && isActive(current));
}

export function learnNavixaVoiceTranscript(text: string, source: NavixaVoiceAliasSource, now = Date.now()): boolean {
  const target = storage();
  if (!target) return false;
  const watchedTerms = target.getItem(WATCH_TERMS_KEY) || "";
  const terms = splitNavixaVoiceTerms(watchedTerms);
  if (!terms.length) return false;
  const match = findNavixaVoiceTerm(text, terms);
  if (!match) return false;
  return rememberNavixaVoiceMatch(match, source, now);
}
