import type { MeetingPart, TranscriptSegment } from "./meetingStore";

const ARABIC_STOP_WORDS = new Set(["في","من","على","الى","إلى","عن","هذا","هذه","ذلك","التي","الذي","ثم","مع","كان","كانت","أن","إن","او","أو","لا","ما","فيه","لها","له","كما","بعد","قبل","عند","بين","كل","قد","تم","هو","هي","نحن","أنا","انت","أنت"]);
const QUALITY_WARNING = "تعذر إنتاج ملخص موثوق لأن التفريغ يحتوي على تكرار أو تشويش مرتفع. أعد التفريغ بصوت أوضح قبل اعتماد النتيجة.";

type LocalSummary = { summary: string; decisions: string[]; tasks: string[]; questions: string[] };

function normalizeText(text: string) { return text.replace(/\s+/g, " ").trim(); }
function fingerprint(text: string) { return normalizeText(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }

export function splitSentences(text: string) {
  return text.replace(/\s+/g, " ").split(/(?<=[.!؟])\s+|\n+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 12);
}

function repeatedNgramRatio(words: string[]) {
  if (words.length < 24) return 0;
  const n = 4;
  const grams = new Map<string, number>();
  let repeated = 0;
  for (let i = 0; i <= words.length - n; i += 1) {
    const gram = words.slice(i, i + n).join(" ");
    const count = (grams.get(gram) || 0) + 1;
    grams.set(gram, count);
    if (count > 1) repeated += 1;
  }
  return repeated / Math.max(1, words.length - n + 1);
}

export function cleanTranscriptNoise(text: string) {
  const sentences = splitSentences(text);
  const seen = new Set<string>();
  const cleaned: string[] = [];
  let duplicates = 0;
  for (const sentence of sentences) {
    const key = fingerprint(sentence);
    if (!key) continue;
    if (seen.has(key)) { duplicates += 1; continue; }
    seen.add(key); cleaned.push(normalizeText(sentence));
  }
  const words = fingerprint(text).split(" ").filter(Boolean);
  const uniqueWords = new Set(words);
  const lexicalRatio = words.length ? uniqueWords.size / words.length : 0;
  const duplicateRatio = sentences.length ? duplicates / sentences.length : 0;
  const ngramRatio = repeatedNgramRatio(words);
  const suspicious = words.length >= 35 && (duplicateRatio >= 0.28 || lexicalRatio < 0.16 || ngramRatio >= 0.22);
  return { text: cleaned.join("\n"), suspicious, duplicateRatio, lexicalRatio, ngramRatio };
}

export function buildLocalSummary(transcript: string): LocalSummary {
  const quality = cleanTranscriptNoise(transcript);
  if (quality.suspicious) return { summary: QUALITY_WARNING, decisions: [], tasks: [], questions: [] };
  const sentences = splitSentences(quality.text);
  const tokens = quality.text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
  const counts = new Map<string, number>();
  for (const token of tokens) if (!ARABIC_STOP_WORDS.has(token)) counts.set(token, (counts.get(token) || 0) + 1);
  const ranked = sentences.map((sentence, index) => ({ sentence, index, score: (sentence.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).reduce((sum, token) => sum + (counts.get(token) || 0), 0) })).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,4).sort((a,b)=>a.index-b.index);
  const pick = (pattern: RegExp, limit: number) => unique(sentences.filter((sentence)=>pattern.test(sentence))).slice(0,limit);
  return { summary: ranked.length ? ranked.map((item)=>item.sentence).join(" ") : "لا يوجد نص كافٍ لإنتاج خلاصة محلية.", decisions: pick(/قرر|اتفق|اعتمد|تمت الموافقة|سنبدأ|نؤجل|اختار/i,8), tasks: pick(/مهمة|إجراء|سوف|يجب|مطلوب|تابع|أرسل|جهز|راجع/i,10), questions: pick(/[؟?]|هل |كيف |متى |لماذا /i,8) };
}

function unique(items: string[]) {
  const seen = new Set<string>();
  return items.map(normalizeText).filter((item)=>{ const key=fingerprint(item); if(!key||seen.has(key)) return false; seen.add(key); return true; });
}

export function mergeMeetingParts(parts: MeetingPart[]) {
  const completed = parts.filter((part)=>part.status === "complete" && part.transcript.trim());
  const rawTranscript = completed.map((part)=>part.transcript.trim()).join("\n\n");
  const quality = cleanTranscriptNoise(rawTranscript);
  const transcript = quality.text || rawTranscript;
  const segments: TranscriptSegment[] = completed.flatMap((part)=>part.segments.map((segment)=>({ start: segment.start + part.startMs/1000, end: segment.end + part.startMs/1000, text: segment.text }))).sort((a,b)=>a.start-b.start);
  if (quality.suspicious) {
    return { transcript, segments, summary: QUALITY_WARNING, decisions: [], tasks: [], questions: [] };
  }
  const local = buildLocalSummary(transcript);
  return { transcript, segments, summary: local.summary, decisions: unique([...completed.flatMap((part)=>part.decisions), ...local.decisions]).slice(0,12), tasks: unique([...completed.flatMap((part)=>part.tasks), ...local.tasks]).slice(0,14), questions: unique([...completed.flatMap((part)=>part.questions), ...local.questions]).slice(0,10) };
}

export function pendingMeetingParts(parts: MeetingPart[]) {
  return parts.filter((part)=>part.status === "pending" || part.status === "processing" || part.status === "error");
}
