"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { deleteMeetingSession, listMeetingSessions, saveMeetingSession, type MeetingPart, type MeetingSession, type TranscriptSegment } from "./meetingStore";
import { buildLocalSummary, mergeMeetingParts, pendingMeetingParts } from "./meetingSummary";
import { applyGlossary, detectSingleWordCorrection, extractFrequentTerms, mergeGlossaries, parseGlossaryInput, type GlossaryTerm } from "./meetingGlossary";
import { academicSuggestions, type AcademicSuggestion } from "./academicSuggestions";
import { saveAcademicReminder } from "../academicReminders";
import "./meetings.css";

type StudioState = "ready" | "recording" | "processing" | "review";
type ModelChoice = "tiny" | "base";
type LanguageChoice = "auto" | "ar" | "en";
type WorkerMessage = { type: string; partId?: string; message?: string; percentage?: number | null; transcript?: string; segments?: TranscriptSegment[] };

const NAVIXA_URL = "https://navixasa.com";
type MeetingPolicy={enabled:boolean;baseModelEnabled:boolean;autoLanguageEnabled:boolean;globalLearningEnabled:boolean;maxFileMb:number;exportPdfEnabled:boolean;exportWordEnabled:boolean;tutorialEnabled:boolean;usageNoticeEnabled:boolean};
const DEFAULT_POLICY:MeetingPolicy={enabled:true,baseModelEnabled:true,autoLanguageEnabled:true,globalLearningEnabled:true,maxFileMb:250,exportPdfEnabled:true,exportWordEnabled:true,tutorialEnabled:true,usageNoticeEnabled:true};
const CHUNK_OPTIONS = [15, 30, 45] as const;

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `meeting-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDuration(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatMinute(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function createPart(index: number, startMs: number, durationMs: number, audio: Blob | null): MeetingPart {
  return { id: newId(), index, startMs, durationMs, audio, status: "pending", transcript: "", segments: [], summary: "", decisions: [], tasks: [], questions: [], model: null };
}

function normalizeSession(session: MeetingSession): MeetingSession {
  if (session.parts?.length) return { ...session, parts: session.parts };
  if (!session.audio) return { ...session, parts: [] };
  const legacyPart: MeetingPart = {
    id: `legacy-${session.id}`,
    index: 0,
    startMs: 0,
    durationMs: session.durationMs,
    audio: session.audio,
    status: session.transcript ? "complete" : "pending",
    transcript: session.transcript,
    segments: session.segments,
    summary: session.summary,
    decisions: session.decisions,
    tasks: session.tasks,
    questions: session.questions,
    model: session.model,
  };
  return { ...session, parts: [legacyPart] };
}

async function decodeAndResample(blob: Blob) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const source = decoded.numberOfChannels === 1 ? decoded.getChannelData(0) : (() => {
      const mono = new Float32Array(decoded.length);
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        const data = decoded.getChannelData(channel);
        for (let index = 0; index < data.length; index += 1) mono[index] += data[index] / decoded.numberOfChannels;
      }
      return mono;
    })();
    const targetRate = 16000;
    const resampled = decoded.sampleRate === targetRate ? new Float32Array(source) : (() => {
      const targetLength = Math.ceil(source.length * targetRate / decoded.sampleRate);
      const output = new Float32Array(targetLength);
      const ratio = decoded.sampleRate / targetRate;
      for (let index = 0; index < targetLength; index += 1) {
        const position = index * ratio;
        const left = Math.floor(position);
        const right = Math.min(left + 1, source.length - 1);
        const weight = position - left;
        output[index] = source[left] * (1 - weight) + source[right] * weight;
      }
      return output;
    })();
    let peak = 0;
    for (const sample of resampled) peak = Math.max(peak, Math.abs(sample));
    const gain = peak > 0.015 ? Math.min(3, 0.92 / peak) : 1;
    if (gain > 1.02) for (let index = 0; index < resampled.length; index += 1) resampled[index] = Math.max(-1, Math.min(1, resampled[index] * gain));
    return resampled;
  } finally {
    await context.close();
  }
}

export default function MeetingStudio() {
  const [state, setState] = useState<StudioState>("ready");
  const [consent, setConsent] = useState(false);
  const [title, setTitle] = useState("محاضرة أو اجتماع جديد");
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState("لا يبدأ التسجيل أو تنزيل النموذج إلا بعد موافقتك.");
  const [model, setModel] = useState<ModelChoice>("tiny");
  const [language, setLanguage] = useState<LanguageChoice>("auto");
  const [chunkMinutes, setChunkMinutes] = useState<number>(30);
  const [draft, setDraft] = useState<MeetingSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<MeetingSession[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [glossaryInput, setGlossaryInput] = useState("");
  const [globalGlossary, setGlobalGlossary] = useState<GlossaryTerm[]>([]);
  const [globalLearningConsent, setGlobalLearningConsent] = useState(false);
  const [manualWrong, setManualWrong] = useState("");
  const [manualCorrect, setManualCorrect] = useState("");
  const [sharingLearning, setSharingLearning] = useState(false);
  const [policy,setPolicy]=useState<MeetingPolicy>(DEFAULT_POLICY);
  const [acceptedAcademicIds, setAcceptedAcademicIds] = useState<string[]>([]);
  const suggestions = useMemo(() => academicSuggestions(`${draft?.summary || ""}\n${draft?.transcript || ""}`), [draft?.summary, draft?.transcript]);
  const acceptAcademicSuggestion = (suggestion: AcademicSuggestion) => {
    saveAcademicReminder({ title: suggestion.title, date: suggestion.date });
    setDraft((current) => current ? { ...current, tasks: [...current.tasks, `تذكير أكاديمي: ${suggestion.title} — ${suggestion.date}`] } : current);
    setAcceptedAcademicIds((current) => [...current, suggestion.id]);
    setNotice("أُضيف الموعد إلى مهام NAVIXA وتذكير محلي قبل يوم من الموعد.");
  };
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const partStartedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const flushRequestedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const draftRef = useRef<MeetingSession | null>(null);
  const currentModelRef = useRef<ModelChoice>(model);

  const refreshSessions = async () => {
    try { setSavedSessions((await listMeetingSessions()).map(normalizeSession)); } catch { setNotice("تعذر قراءة الجلسات المحلية على هذا المتصفح."); }
  };

  useEffect(() => { void refreshSessions(); }, []);
  useEffect(()=>{let active=true;fetch("/api/meetings/policy",{cache:"no-store"}).then(response=>response.ok?response.json():DEFAULT_POLICY).then((next:MeetingPolicy)=>{if(active)setPolicy({...DEFAULT_POLICY,...next})}).catch(()=>{});return()=>{active=false}},[]);
  useEffect(()=>{let active=true;fetch("/api/meetings/glossary",{cache:"force-cache"}).then(response=>response.ok?response.json():{terms:[]}).then((data:{terms?:GlossaryTerm[]})=>{if(active)setGlobalGlossary(Array.isArray(data.terms)?data.terms:[])}).catch(()=>{});return()=>{active=false}},[]);
  useEffect(()=>{if(!policy.baseModelEnabled&&model==="base")setModel("tiny");if(!policy.autoLanguageEnabled&&language==="auto")setLanguage("ar")},[policy,model,language]);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { currentModelRef.current = model; }, [model]);
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    workerRef.current?.terminate();
  }, []);
  useEffect(() => {
    const flushBeforeBackground = () => {
      const recorder = recorderRef.current;
      if (document.visibilityState === "hidden" && recorder?.state === "recording") { flushRequestedRef.current = true; recorder.requestData(); }
    };
    document.addEventListener("visibilitychange", flushBeforeBackground);
    return () => document.removeEventListener("visibilitychange", flushBeforeBackground);
  }, []);

  const persist = (session: MeetingSession, message?: string) => {
    const normalized = normalizeSession(session);
    draftRef.current = normalized;
    setDraft(normalized);
    void saveMeetingSession(normalized).then(() => void refreshSessions()).catch(() => setNotice("تعذر حفظ آخر جزء محليًا. تحقق من مساحة تخزين المتصفح قبل المتابعة."));
    if (message) setNotice(message);
  };

  const shareGlossaryTerms = async (terms: GlossaryTerm[], source: "correction" | "approved", consented: boolean) => {
    if (!policy.globalLearningEnabled || !consented || !terms.length) return false;
    const response = await fetch("/api/meetings/glossary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true, source, terms }) }).catch(() => null);
    if (!response?.ok) return false;
    return true;
  };

  const addGlossaryCorrection = (wrong: string, correct: string) => {
    if (!draft || !wrong.trim() || !correct.trim()) return;
    const term: GlossaryTerm = { canonical: correct.trim(), aliases: [wrong.trim()] };
    const session = normalizeSession(draft);
    const next = { ...session, glossary: mergeGlossaries(session.glossary || [], [term]) };
    persist(next, "أُضيف التصحيح إلى قاموس هذه الجلسة ويُطبّق على الأجزاء القادمة.");
    setManualWrong(""); setManualCorrect("");
    void shareGlossaryTerms([term], "correction", Boolean(next.globalLearningConsent));
  };

  const approveLearning = async () => {
    if (!draft?.transcript.trim()) { setNotice("أكمل التفريغ أولًا قبل اعتماد النتيجة."); return; }
    const session = normalizeSession(draft);
    const learned = mergeGlossaries(session.glossary || [], extractFrequentTerms(session.transcript));
    const next = { ...session, glossary: learned };
    if (!next.globalLearningConsent || !policy.globalLearningEnabled) {
      persist(next, "اعتمدت النتيجة محليًا. فعّل موافقة إرسال المصطلحات للمراجعة إن أردت اقتراحها للقاموس العام.");
      return;
    }
    setSharingLearning(true);
    const shared = await shareGlossaryTerms(learned, "approved", true);
    setSharingLearning(false);
    persist({ ...next, learningShared: shared || next.learningShared }, shared ? "اعتمدت النتيجة وأُرسلت المصطلحات المنقّحة إلى مراجعة مدير NAVIXA؛ لا يُرسل الصوت أو النص." : "اعتمدت النتيجة محليًا، وتعذر إرسال المقترحات للمراجعة الآن. يمكنك المحاولة لاحقًا.");
  };

  const createSession = (nextTitle: string, nextChunkMinutes: number): MeetingSession => ({
    id: newId(), title: nextTitle.trim() || "جلسة بلا عنوان", createdAt: new Date().toISOString(), durationMs: 0,
    audio: null, transcript: "", segments: [], summary: "", decisions: [], tasks: [], questions: [], model: null,
    parts: [], chunkMinutes: nextChunkMinutes, glossary: parseGlossaryInput(glossaryInput), globalLearningConsent,
  });

  const appendRecordedPart = (final = false) => {
    const items = chunksRef.current;
    const current = draftRef.current;
    if (!items.length || !current) return;
    chunksRef.current = [];
    const durationMs = Math.max(1000, Date.now() - partStartedAtRef.current);
    const audio = new Blob(items, { type: recorderRef.current?.mimeType || "audio/webm" });
    const normalized = normalizeSession(current);
    const part = createPart(normalized.parts?.length || 0, Math.max(0, partStartedAtRef.current - startedAtRef.current), durationMs, audio);
    const next: MeetingSession = { ...normalized, title: title.trim() || normalized.title, durationMs: Math.max(Date.now() - startedAtRef.current, normalized.durationMs), parts: [...(normalized.parts || []), part], chunkMinutes };
    partStartedAtRef.current = Date.now();
    persist(next, final ? "اكتمل الحفظ المحلي. يمكنك الآن تفريغ الأجزاء بالتتابع أو العودة لاحقًا." : `حُفظ الجزء ${part.index + 1} محليًا، والتسجيل مستمر.`);
  };

  const finishCapture = (audio: Blob, durationMs: number) => {
    const session = createSession(title, chunkMinutes);
    const part = createPart(0, 0, durationMs, audio);
    persist({ ...session, durationMs, parts: [part] }, "تمت إضافة الجلسة محليًا. يمكنك تفريغها الآن أو العودة إليها لاحقًا.");
    setElapsed(durationMs); setState("review");
  };

  const startRecording = async () => {
    if (!policy.enabled) { setNotice("ميزة التلخيص متوقفة مؤقتًا من إعدادات NAVIXA."); return; }
    if (policy.usageNoticeEnabled&&!consent) { setNotice("أكد أولًا أن لديك حق التسجيل وموافقة الحاضرين عند الحاجة."); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setNotice("لا يدعم هذا المتصفح التسجيل المحلي. جرّب متصفحًا حديثًا مثل Chrome أو Edge أو Safari."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const session = createSession(title, chunkMinutes);
      chunksRef.current = [];
      flushRequestedRef.current = false;
      persist(session);
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        chunksRef.current.push(event.data);
        if (flushRequestedRef.current || Date.now() - partStartedAtRef.current >= chunkMinutes * 60 * 1000) { flushRequestedRef.current = false; appendRecordedPart(false); }
      };
      recorder.onstop = () => {
        appendRecordedPart(true);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null; recorderRef.current = null;
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setState("review");
      };
      recorder.start(10_000); recorderRef.current = recorder; streamRef.current = stream; startedAtRef.current = Date.now(); partStartedAtRef.current = startedAtRef.current;
      setElapsed(0); setState("recording"); setNotice(`يُحفظ جزء مستقل كل ${chunkMinutes} دقيقة على جهازك.`);
      timerRef.current = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 250);
    } catch (error) {
      setNotice(error instanceof DOMException && error.name === "NotAllowedError" ? "لم تُمنح صلاحية الميكروفون. غيّرها من إعدادات المتصفح ثم حاول مجددًا." : "تعذر بدء التسجيل. تحقق من الميكروفون ثم حاول مجددًا.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setState("processing"); setNotice("جارٍ حفظ الجزء الأخير محليًا…");
    recorderRef.current?.stop();
  };

  const importAudio = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (policy.usageNoticeEnabled&&!consent) { setNotice("أكد الموافقة قبل استيراد ملف صوت خاص."); return; }
    if (!file.type.startsWith("audio/")) { setNotice("اختر ملفًا صوتيًا صالحًا فقط."); return; }
    if (file.size > policy.maxFileMb * 1024 * 1024) { setNotice(`حجم الملف أكبر من الحد المحلي الحالي (${policy.maxFileMb}MB). قسّمه إلى جلسات أقصر.`); return; }
    finishCapture(file, 0);
  };

  const ensureWorker = () => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("./transcription.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;
      if (data.type === "progress") { setProgress(typeof data.percentage === "number" ? data.percentage : null); return; }
      if (data.type === "state") { setNotice(data.message || "جارٍ التحضير…"); return; }
      const current = draftRef.current;
      if (!current || !data.partId) return;
      const normalized = normalizeSession(current);
      if (data.type === "error") {
        const next = { ...normalized, parts: (normalized.parts || []).map((part) => part.id === data.partId ? { ...part, status: "error" as const, error: data.message || "تعذر التفريغ" } : part) };
        persist(next, data.message || "تعذر تفريغ هذا الجزء. يمكنك استئنافه لاحقًا.");
        setProgress(null); setState("review"); return;
      }
      if (data.type === "complete") {
        const glossary = mergeGlossaries(globalGlossary, normalized.glossary || []);
        const correctedTranscript = applyGlossary(data.transcript || "", glossary);
        const local = buildLocalSummary(correctedTranscript);
        const nextWithPart = { ...normalized, parts: (normalized.parts || []).map((part) => part.id === data.partId ? { ...part, status: "complete" as const, transcript: correctedTranscript, segments: (data.segments || []).map((segment) => ({ ...segment, text: applyGlossary(segment.text, glossary) })), summary: local.summary, decisions: local.decisions, tasks: local.tasks, questions: local.questions, model: currentModelRef.current, error: undefined } : part) };
        const merged = mergeMeetingParts(nextWithPart.parts || []);
        const repeated = extractFrequentTerms(merged.transcript);
        const next = { ...nextWithPart, ...merged, glossary: mergeGlossaries(nextWithPart.glossary || [], repeated), model: currentModelRef.current };
        const remaining = pendingMeetingParts(next.parts || []);
        persist(next, remaining.length ? `اكتمل جزء. سيبدأ تفريغ الجزء التالي تلقائيًا (${remaining.length} متبقٍ).` : "اكتمل تفريغ جميع الأجزاء ودمجها محليًا.");
        setProgress(null);
        if (remaining.length) window.setTimeout(() => void transcribePart(next, remaining[0].id), 80);
        else setState("review");
      }
    };
    workerRef.current = worker; return worker;
  };

  const transcribePart = async (session: MeetingSession, partId: string) => {
    const normalized = normalizeSession(session);
    const part = (normalized.parts || []).find((item) => item.id === partId);
    if (!part?.audio) { setState("review"); setNotice("لا يوجد ملف صوت محفوظ لهذا الجزء."); return; }
    try {
      const preparing = { ...normalized, parts: (normalized.parts || []).map((item) => item.id === partId ? { ...item, status: "processing" as const, error: undefined } : item) };
      persist(preparing, `جارٍ تجهيز الجزء ${part.index + 1} للتفريغ المحلي…`);
      setState("processing"); setProgress(0);
      const audio = await decodeAndResample(part.audio);
      const worker = ensureWorker();
      worker.postMessage({ type: "transcribe", partId, audio, model, language }, [audio.buffer]);
    } catch {
      const failed = { ...normalized, parts: (normalized.parts || []).map((item) => item.id === partId ? { ...item, status: "error" as const, error: "تعذر تجهيز الجزء" } : item) };
      persist(failed, "تعذر تجهيز هذا الجزء محليًا. جرّبه مجددًا أو استخدم مدة جزء أقصر.");
      setState("review"); setProgress(null);
    }
  };

  const transcribe = async () => {
    if (!policy.enabled) { setNotice("ميزة التلخيص متوقفة مؤقتًا من إعدادات NAVIXA."); return; }
    if (!draft) { setNotice("أضف تسجيلًا أو ملفًا صوتيًا أولًا."); return; }
    const session = normalizeSession(draft);
    const nextPart = pendingMeetingParts(session.parts || [])[0];
    if (!nextPart) { setNotice("تم تفريغ جميع الأجزاء المحفوظة بالفعل."); return; }
    await transcribePart(session, nextPart.id);
  };

  const updateTranscript = (nextText: string) => {
    if (!draft) return;
    const correction = detectSingleWordCorrection(draft.transcript, nextText);
    const local = buildLocalSummary(nextText);
    const session = normalizeSession(draft);
    if (!correction) { setDraft({ ...session, transcript: nextText, summary: local.summary, decisions: local.decisions, tasks: local.tasks, questions: local.questions }); return; }
    const term: GlossaryTerm = { canonical: correction.to, aliases: [correction.from] };
    const next = { ...session, transcript: nextText, summary: local.summary, decisions: local.decisions, tasks: local.tasks, questions: local.questions, glossary: mergeGlossaries(session.glossary || [], [term]) };
    persist(next, `تعلّم NAVIXA محليًا تصحيح «${correction.from}» إلى «${correction.to}».`);
    void shareGlossaryTerms([term], "correction", Boolean(next.globalLearningConsent));
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const next = { ...normalizeSession(draft), title: title.trim() || draft.title, chunkMinutes };
      persist(next); await refreshSessions(); setNotice("حُفظت الجلسة وأجزاؤها داخل هذا الجهاز فقط.");
    } catch { setNotice("تعذر حفظ الجلسة محليًا. تأكد من مساحة التخزين في المتصفح."); }
    finally { setSaving(false); }
  };

  const eraseDraft = () => { setDraft(null); draftRef.current = null; setElapsed(0); setState("ready"); setProgress(null); setNotice("أُغلقت الجلسة الحالية. تبقى أي أجزاء محفوظة في مكتبتك المحلية."); };
  const removeSaved = async (id: string) => { await deleteMeetingSession(id); await refreshSessions(); if (draft?.id === id) eraseDraft(); setNotice("تم حذف الجلسة وأجزائها من هذا الجهاز."); };
  const exportText = () => {
    if (!draft) return;
    const parts = normalizeSession(draft).parts || [];
    const content = ["NAVIXA SA — لخّص اجتماعك", NAVIXA_URL, "ختم NAVIXA SA · ملخص محلي قابل للمراجعة", "", `# ${draft.title}`, `التاريخ: ${new Date(draft.createdAt).toLocaleString("ar-SA")}`, "", "## أجزاء الجلسة", ...(parts.length ? parts.map((part) => `- الجزء ${part.index + 1}: ${formatDuration(part.startMs)} — ${formatDuration(part.startMs + part.durationMs)} · ${part.status === "complete" ? "مفرّغ" : "بانتظار التفريغ"}`) : ["- لا توجد أجزاء محفوظة"]), "", "## الخلاصة", draft.summary || "لا يوجد ملخص بعد.", "", "## القرارات", ...(draft.decisions.length ? draft.decisions.map((value) => `- ${value}`) : ["- لا يوجد"]), "", "## المهام", ...(draft.tasks.length ? draft.tasks.map((value) => `- ${value}`) : ["- لا يوجد"]), "", "## النص الزمني", ...(draft.segments.length ? draft.segments.map((segment) => `[${formatMinute(segment.start)}] ${segment.text}`) : [draft.transcript || "لا يوجد نص بعد."]), "", `ختم NAVIXA SA · أُنشئ محليًا عبر NAVIXA SA · ${NAVIXA_URL}`].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `navixa-summary-${draft.id.slice(0, 8)}.md`; link.click(); URL.revokeObjectURL(url);
    setNotice("تم تصدير النص والملخص إلى ملف محلي.");
  };

  const exportPdf = () => {
    if (!draft) return;
    setNotice("سيظهر مربع الطباعة المحلي الآن. اختر «حفظ بصيغة PDF» لإخراج الملخص من جهازك.");
    window.setTimeout(() => window.print(), 80);
  };

  const exportWord = async () => {
    if (!draft) return;
    try {
      setNotice("جارٍ تجهيز ملف Word محليًا…");
      const { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } = await import("docx");
      const logoResponse = await fetch("/navixa-export-logo.png");
      if (!logoResponse.ok) throw new Error("logo");
      const logo = new ImageRun({ data: await logoResponse.arrayBuffer(), transformation: { width: 38, height: 38 }, type: "png" });
      const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.RIGHT });
      const bulletLines = (items: string[], fallback: string) => (items.length ? items : [fallback]).map((text) => new Paragraph({ text: `• ${text}`, alignment: AlignmentType.RIGHT }));
      const parts = normalizeSession(draft).parts || [];
      const doc = new Document({ sections: [{ children: [
        new Paragraph({ children: [logo, new TextRun({ text: "  NAVIXA SA — لخّص اجتماعك", bold: true, size: 30 })], alignment: AlignmentType.RIGHT }),
        new Paragraph({ children: [new TextRun({ text: "ختم NAVIXA SA · ملخص محلي قابل للمراجعة", color: "7656D6", bold: true, size: 19 })], alignment: AlignmentType.RIGHT }),
        new Paragraph({ children: [new TextRun({ text: NAVIXA_URL, color: "178F90", underline: {} })], alignment: AlignmentType.RIGHT }),
        new Paragraph({ text: draft.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.RIGHT }),
        new Paragraph({ text: `التاريخ: ${new Date(draft.createdAt).toLocaleString("ar-SA")} · أُنشئ محليًا على جهازك`, alignment: AlignmentType.RIGHT }),
        heading("أجزاء الجلسة"), ...parts.map((part) => new Paragraph({ text: `الجزء ${part.index + 1}: ${formatDuration(part.startMs)} — ${formatDuration(part.startMs + part.durationMs)} · ${part.status === "complete" ? "مفرّغ" : "بانتظار التفريغ"}`, alignment: AlignmentType.RIGHT })),
        heading("الخلاصة"), new Paragraph({ text: draft.summary || "لا يوجد ملخص بعد.", alignment: AlignmentType.RIGHT }),
        heading("القرارات"), ...bulletLines(draft.decisions, "لا يوجد"),
        heading("المهام"), ...bulletLines(draft.tasks, "لا يوجد"),
        heading("الأسئلة"), ...bulletLines(draft.questions, "لا يوجد"),
        heading("النص الزمني"), ...(draft.segments.length ? draft.segments.map((segment) => new Paragraph({ text: `[${formatMinute(segment.start)}] ${segment.text}`, alignment: AlignmentType.RIGHT })) : [new Paragraph({ text: draft.transcript || "لا يوجد نص بعد.", alignment: AlignmentType.RIGHT })]),
      ] }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `navixa-summary-${draft.id.slice(0, 8)}.docx`; link.click(); URL.revokeObjectURL(url);
      setNotice("تم إنشاء ملف Word محليًا على جهازك.");
    } catch { setNotice("تعذر إنشاء Word محليًا. تأكد من مساحة الجهاز ثم حاول مجددًا."); }
  };

  const parts = draft ? normalizeSession(draft).parts || [] : [];
  const completedParts = parts.filter((part) => part.status === "complete").length;

  return <main className="meeting-page" dir="rtl">
    <header className="meeting-topbar">
      <Link className="meeting-back" href="/">← العودة للرئيسية</Link>
      <div className="meeting-identity"><img src="/navixa-mark.webp" alt="" /><div><small>NAVIXA LOCAL</small><h1>سجّل ولخّص</h1></div></div>
      <span className="meeting-beta">تجريبي · محلي</span>
    </header>

    <section className="meeting-hero">
      <div><small>محاضرات واجتماعات</small><h2>من أول دقيقة إلى آخر دقيقة، <em>على جهازك</em></h2><p>{policy.enabled?"يسجّل NAVIXA أجزاء محلية متتابعة، ويفرّغها ويلخّصها ثم يجمعها في نتيجة واحدة قابلة للمراجعة. لا يُرفع ملفك الصوتي إلى NAVIXA.":"الميزة متوقفة مؤقتًا من إعدادات NAVIXA. تبقى جلساتك المحفوظة محليًا على جهازك."}</p></div>
      <div className="meeting-hero-stats"><span>⌁ التسجيل بإذنك</span><span>◌ لا رفع افتراضي</span><span>↯ استئناف محلي</span></div>
    </section>

    <section className="meeting-studio" aria-label="استوديو التلخيص المحلي">
      <div className="meeting-stage">
        <div className="meeting-stage-head"><div><small>{state === "recording" ? "● تسجيل محلي جارٍ" : state === "processing" ? "⌁ معالجة محلية" : "جلسة جديدة"}</small><h2>{state === "recording" ? formatDuration(elapsed) : draft ? draft.title : "لخّص محاضرة أو اجتماعًا"}</h2></div><span className={`meeting-state ${state}`}>{state === "recording" ? "● جاري" : state === "processing" ? "جارٍ التحضير" : draft ? "جاهز للمراجعة" : "لم يبدأ"}</span></div>
        {!draft && state !== "recording" && <div className="meeting-start-area">
          <div className="meeting-record-circle" aria-hidden="true">●</div>
          <p>لن نطلب إذن الميكروفون أو ننزّل أي نموذج قبل أن تبدأ أنت.</p>
          {policy.usageNoticeEnabled&&<label className="meeting-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>أؤكد أن لدي حق التسجيل، وأنني سأحصل على موافقة الحاضرين عند الحاجة.</span></label>}
          <div className="meeting-glossary-intake"><label>مصطلحات مهمة لهذا الاجتماع <small>اختياري · سطر لكل مصطلح: الاسم الصحيح — النطق أو الكتابة البديلة</small><textarea value={glossaryInput} onChange={(event) => setGlossaryInput(event.target.value)} maxLength={1800} placeholder={"NAVIXA — نافيكسا\nCloudflare Workers — كلاودفلير ووركرز\nDr. Sarah Al-Harbi — د. سارة الحربي"} /></label><p>يُحفظ هذا القاموس داخل هذه الجلسة على جهازك ويصحح النص قبل التلخيص.</p>{policy.globalLearningEnabled&&<label className="meeting-global-learning"><input type="checkbox" checked={globalLearningConsent} onChange={(event) => setGlobalLearningConsent(event.target.checked)} /><span><b>أرسل مصطلحات منقّحة للمراجعة</b><small>يراجع المدير المصطلحات قبل اعتمادها للجميع؛ لا نرسل الصوت أو النص الكامل أو عنوان الاجتماع.</small></span></label>}</div>
          <div className="meeting-chunk-explainer"><label className="meeting-chunk-control"><span>مدة الجزء التلقائي</span><select value={chunkMinutes} onChange={(event) => setChunkMinutes(Number(event.target.value))}><option value={15}>15 دقيقة — أنسب للجوال أو المساحة المحدودة</option><option value={30}>30 دقيقة — الخيار المتوازن الموصى به</option><option value={45}>45 دقيقة — كمبيوتر قوي ومساحة مريحة</option></select></label><p><b>اختر 15 دقيقة</b> لاجتماع طويل على جوال، أو <b>30 دقيقة</b> كخيار متوازن، أو <b>45 دقيقة</b> عند استخدام كمبيوتر قوي.</p></div>
          <div className="meeting-start-actions"><button type="button" className="meeting-primary" disabled={!policy.enabled} onClick={startRecording}>● ابدأ التسجيل</button><button type="button" className="meeting-secondary" disabled={!policy.enabled} onClick={() => audioInputRef.current?.click()}>↑ استورد ملفًا صوتيًا</button><input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={importAudio} /></div>
        </div>}
        {state === "recording" && <div className="meeting-recording-area"><div className="meeting-wave" aria-hidden="true">{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 17) % 54)}px` }} />)}</div><p>يحفظ NAVIXA جزءًا محليًا كل {chunkMinutes} دقيقة. إذا أغلقت الصفحة، تبقى الأجزاء المحفوظة ويمكن استئناف التفريغ عند العودة.</p><button type="button" className="meeting-stop" onClick={stopRecording}>■ أوقف التسجيل</button></div>}
        {state === "processing" && <div className="meeting-processing"><div className="meeting-spinner" aria-hidden="true" /><p>{notice}</p>{progress !== null && <div className="meeting-progress"><i style={{ width: `${Math.max(3, progress)}%` }} /><span>{progress}%</span></div>}</div>}
        {draft && state === "review" && <div className="meeting-review-actions"><div><label>عنوان الجلسة<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label><small>المدة: {draft.durationMs ? formatDuration(draft.durationMs) : "ملف مستورد"} · {completedParts}/{parts.length} أجزاء مفرّغة</small>{draft.glossary?.length ? <p className="meeting-glossary-state">قاموس الجلسة: {draft.glossary.slice(0,4).map((term) => <b key={term.canonical}>{term.canonical}</b>)}{draft.glossary.length>4&&<span>+{draft.glossary.length-4}</span>}</p> : <p className="meeting-glossary-state muted">لا توجد مصطلحات مخصصة بعد.</p>}</div><div className="meeting-review-buttons"><button type="button" className="meeting-primary" onClick={() => void transcribe()} disabled={state === "processing"||!policy.enabled||!parts.length}>⌁ {completedParts === parts.length && parts.length ? "تم التفريغ" : "تفريغ الأجزاء المحفوظة"}</button><button type="button" className="meeting-secondary" onClick={() => void saveDraft()} disabled={saving}>{saving ? "جارٍ الحفظ" : "حفظ على جهازي"}</button><button type="button" className="meeting-text-button" onClick={eraseDraft}>إغلاق الجلسة</button></div></div>}
        {parts.length > 0 && <div className="meeting-part-list" aria-label="أجزاء الجلسة">{parts.map((part) => <div key={part.id} className={`meeting-part ${part.status}`}><b>الجزء {part.index + 1}</b><span>{formatDuration(part.startMs)} — {formatDuration(part.startMs + part.durationMs)}</span><em>{part.status === "complete" ? "مفرّغ" : part.status === "processing" ? "جارٍ التفريغ" : part.status === "error" ? "أعد المحاولة" : "محفوظ"}</em></div>)}</div>}
        <p className="meeting-notice" role="status">{notice}</p>
      </div>

      <aside className="meeting-model-panel"><small>محرك محلي</small><h3>اختر الدقة واللغة قبل التنزيل</h3><p>يُنزل النموذج مرة واحدة إلى ذاكرة المتصفح عند أول تفريغ. بعد ذلك يعمل التفريغ محليًا من ذاكرة التخزين المتاحة.</p><label className={model === "tiny" ? "selected" : ""}><input type="radio" name="model" checked={model === "tiny"} onChange={() => setModel("tiny")} /><b>خفيف</b><span>تجربة أسرع، أدقّته أقل</span></label>{policy.baseModelEnabled&&<label className={model === "base" ? "selected" : ""}><input type="radio" name="model" checked={model === "base"} onChange={() => setModel("base")} /><b>متوازن</b><span>أبطأ وأكبر، مناسب للنص الأفضل</span></label>}<div className="meeting-language"><b>لغة الجلسة</b><div>{policy.autoLanguageEnabled&&<label className={language === "auto" ? "selected" : ""}><input type="radio" name="language" value="auto" checked={language === "auto"} onChange={() => setLanguage("auto")} />تلقائي عربي/English</label>}<label className={language === "ar" ? "selected" : ""}><input type="radio" name="language" value="ar" checked={language === "ar"} onChange={() => setLanguage("ar")} />العربية</label><label className={language === "en" ? "selected" : ""}><input type="radio" name="language" value="en" checked={language === "en"} onChange={() => setLanguage("en")} />English</label></div></div><div className="meeting-model-note">عند الاجتماعات الطويلة، يحلل NAVIXA جزءًا واحدًا فقط في كل مرة ثم ينتقل تلقائيًا للجزء التالي. إغلاق الصفحة يوقف التفريغ فقط، ولا يحذف الأجزاء المحفوظة.</div></aside>
    </section>

    {draft && state === "review" && <section className="meeting-output">
      <div className="meeting-print-brand"><img src="/navixa-export-logo.png" alt="NAVIXA SA" /><div><b>NAVIXA SA — لخّص اجتماعك</b><span className="meeting-brand-seal">ختم NAVIXA SA · ملخص محلي قابل للمراجعة</span><a href={NAVIXA_URL}>{NAVIXA_URL}</a></div></div>
      <div className="meeting-output-head"><div><small>نتيجة محلية قابلة للتحرير</small><h2>الملخص والنص الزمني</h2></div><div className="meeting-export-actions">{policy.globalLearningEnabled&&<button type="button" className="meeting-secondary meeting-approve-learning" onClick={() => void approveLearning()} disabled={sharingLearning||!draft.transcript.trim()}>{sharingLearning?"جارٍ الإرسال…":draft.learningShared?"✓ أُرسلت للمراجعة":"✓ اعتماد النتيجة"}</button>}<button type="button" className="meeting-secondary" onClick={exportText}>↓ نص</button>{policy.exportPdfEnabled&&<button type="button" className="meeting-secondary" onClick={exportPdf}>↓ PDF</button>}{policy.exportWordEnabled&&<button type="button" className="meeting-secondary" onClick={() => void exportWord()}>↓ Word</button>}</div></div>
      <div className="meeting-output-grid">
        <section className="meeting-summary-pane"><label>الخلاصة<textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="سيظهر هنا ملخص محلي بعد التفريغ…" /></label>{suggestions.length>0&&<section className="academic-suggestion-review"><div><small>اقتراحات من النص المحلي</small><h3>راجع الموعد قبل إضافته</h3><p>لا ينشئ NAVIXA تنبيهًا تلقائيًا؛ تحقق من التاريخ ثم أضفه كتذكير قابل للتعديل.</p></div>{suggestions.map((suggestion)=><article key={suggestion.id}><div><b>{suggestion.title}</b><span>{suggestion.date}</span></div><button type="button" disabled={acceptedAcademicIds.includes(suggestion.id)} onClick={()=>acceptAcademicSuggestion(suggestion)}>{acceptedAcademicIds.includes(suggestion.id)?"أُضيف للتذكيرات":"أضف كتذكير"}</button></article>)}</section>}<div className="meeting-lists"><div><h3>قرارات</h3>{draft.decisions.length ? draft.decisions.map((item, index) => <p key={`${item}-${index}`}>✓ {item}</p>) : <p className="empty">ستظهر القرارات المحتملة هنا بعد التفريغ.</p>}</div><div><h3>مهام</h3>{draft.tasks.length ? draft.tasks.map((item, index) => <p key={`${item}-${index}`}>→ {item}</p>) : <p className="empty">ستظهر المهام المحتملة هنا بعد التفريغ.</p>}</div></div></section>
        <section className="meeting-transcript-pane"><label>النص الزمني<textarea value={draft.transcript} onChange={(event) => updateTranscript(event.target.value)} placeholder="سيظهر النص هنا بعد التفريغ…" /></label><div className="meeting-correction-form"><b>صحّح مصطلحًا</b><input value={manualWrong} onChange={(event) => setManualWrong(event.target.value)} placeholder="الكتابة الخاطئة" maxLength={80}/><input value={manualCorrect} onChange={(event) => setManualCorrect(event.target.value)} placeholder="الكتابة الصحيحة" maxLength={80}/><button type="button" onClick={() => addGlossaryCorrection(manualWrong,manualCorrect)} disabled={!manualWrong.trim()||!manualCorrect.trim()}>أضف للقاموس</button><small>يُصحح محليًا الآن. لا يُرسل للمراجعة إلا إذا فعّلت الموافقة قبل التسجيل.</small></div><div className="meeting-timeline">{draft.segments.length ? draft.segments.slice(0, 8).map((segment, index) => <button type="button" key={`${segment.start}-${index}`} onClick={() => setNotice(`المقطع عند ${formatMinute(segment.start)} محفوظ داخل النص المحلي.`)}><time>{formatMinute(segment.start)}</time><span>{segment.text}</span></button>) : <p>لا توجد طوابع زمنية بعد.</p>}</div></section>
      </div>
    </section>}

    <section className="meeting-library"><div><small>على هذا الجهاز فقط</small><h2>جلساتك المحفوظة</h2></div>{savedSessions.length ? <div className="meeting-library-list">{savedSessions.slice(0, 8).map((session) => <article key={session.id}><div><b>{session.title}</b><small>{new Date(session.createdAt).toLocaleDateString("ar-SA")} · {(session.parts || []).filter((part) => part.status === "complete").length}/{(session.parts || []).length} أجزاء مفرّغة</small></div><div><button type="button" onClick={() => { const normalized = normalizeSession(session); setDraft(normalized); draftRef.current = normalized; setTitle(normalized.title); setElapsed(normalized.durationMs); setChunkMinutes(normalized.chunkMinutes || 30); setGlossaryInput((normalized.glossary || []).map((term) => [term.canonical, ...term.aliases].join(" — ")).join("\n")); setGlobalLearningConsent(Boolean(normalized.globalLearningConsent)); setState("review"); setNotice("فُتحت الجلسة من تخزين هذا الجهاز. يمكنك استئناف الأجزاء المتبقية."); }}>فتح</button><button type="button" className="danger" onClick={() => void removeSaved(session.id)}>حذف</button></div></article>)}</div> : <p className="meeting-library-empty">لا توجد جلسات محفوظة. ستبقى الأجزاء التي تحفظها داخل متصفحك على هذا الجهاز.</p>}</section>
  </main>;
}
