import type { MeetingPart, TranscriptSegment } from "./meetingStore";

const ARABIC_STOP_WORDS = new Set(["في","من","على","الى","إلى","عن","هذا","هذه","ذلك","التي","الذي","ثم","مع","كان","كانت","أن","إن","او","أو","لا","ما","فيه","لها","له","كما","بعد","قبل","عند","بين","كل","قد","تم","هو","هي","نحن","أنا","انت","أنت"]);

type LocalSummary = {
  summary: string;
  decisions: string[];
  tasks: string[];
  questions: string[];
};

export function splitSentences(text: string) {
  return text.replace(/\s+/g, " ").split(/(?<=[.!؟])\s+|\n+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 12);
}

export function buildLocalSummary(transcript: string): LocalSummary {
  const sentences = splitSentences(transcript);
  const tokens = transcript.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
  const counts = new Map<string, number>();
  for (const token of tokens) if (!ARABIC_STOP_WORDS.has(token)) counts.set(token, (counts.get(token) || 0) + 1);
  const ranked = sentences.map((sentence, index) => {
    const score = (sentence.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).reduce((sum, token) => sum + (counts.get(token) || 0), 0);
    return { sentence, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 4).sort((a, b) => a.index - b.index);
  const decisions = sentences.filter((sentence) => /قرر|اتفق|اعتمد|تمت الموافقة|سنبدأ|نؤجل|اختار/i.test(sentence)).slice(0, 8);
  const tasks = sentences.filter((sentence) => /مهمة|إجراء|سوف|يجب|مطلوب|تابع|أرسل|جهز|راجع/i.test(sentence)).slice(0, 10);
  const questions = sentences.filter((sentence) => /[؟?]|هل |كيف |متى |لماذا /i.test(sentence)).slice(0, 8);
  return {
    summary: ranked.length ? ranked.map((item) => item.sentence).join(" ") : "لا يوجد نص كافٍ لإنتاج خلاصة محلية.",
    decisions,
    tasks,
    questions,
  };
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function mergeMeetingParts(parts: MeetingPart[]) {
  const completed = parts.filter((part) => part.status === "complete" && part.transcript.trim());
  const transcript = completed.map((part) => part.transcript.trim()).join("\n\n");
  const segments: TranscriptSegment[] = completed.flatMap((part) => part.segments.map((segment) => ({
    start: segment.start + part.startMs / 1000,
    end: segment.end + part.startMs / 1000,
    text: segment.text,
  }))).sort((a, b) => a.start - b.start);
  const local = buildLocalSummary(transcript);
  return {
    transcript,
    segments,
    summary: local.summary,
    decisions: unique([...completed.flatMap((part) => part.decisions), ...local.decisions]).slice(0, 12),
    tasks: unique([...completed.flatMap((part) => part.tasks), ...local.tasks]).slice(0, 14),
    questions: unique([...completed.flatMap((part) => part.questions), ...local.questions]).slice(0, 10),
  };
}

export function pendingMeetingParts(parts: MeetingPart[]) {
  return parts.filter((part) => part.status === "pending" || part.status === "processing" || part.status === "error");
}
