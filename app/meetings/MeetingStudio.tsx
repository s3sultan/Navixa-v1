"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { deleteMeetingSession, listMeetingSessions, saveMeetingSession, type MeetingSession, type TranscriptSegment } from "./meetingStore";
import "./meetings.css";

type StudioState = "ready" | "recording" | "processing" | "review";
type ModelChoice = "tiny" | "base";
type LanguageChoice = "auto" | "ar" | "en";
type WorkerMessage = { type: string; message?: string; percentage?: number | null; transcript?: string; segments?: TranscriptSegment[] };

const ARABIC_STOP_WORDS = new Set(["في","من","على","الى","إلى","عن","هذا","هذه","ذلك","التي","الذي","ثم","مع","كان","كانت","أن","إن","او","أو","لا","ما","فيه","لها","له","كما","بعد","قبل","عند","بين","كل","قد","تم","هو","هي","نحن","أنا","انت","أنت"]);
const NAVIXA_URL = "https://navixa.s2shug.workers.dev";
type MeetingPolicy={enabled:boolean;baseModelEnabled:boolean;autoLanguageEnabled:boolean;maxFileMb:number;exportPdfEnabled:boolean;exportWordEnabled:boolean;tutorialEnabled:boolean;usageNoticeEnabled:boolean};
const DEFAULT_POLICY:MeetingPolicy={enabled:true,baseModelEnabled:true,autoLanguageEnabled:true,maxFileMb:250,exportPdfEnabled:true,exportWordEnabled:true,tutorialEnabled:true,usageNoticeEnabled:true};

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

function splitSentences(text: string) {
  return text.replace(/\s+/g, " ").split(/(?<=[.!؟])\s+|\n+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 12);
}

function buildLocalSummary(transcript: string) {
  const sentences = splitSentences(transcript);
  const tokens = transcript.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (!ARABIC_STOP_WORDS.has(token)) counts.set(token, (counts.get(token) || 0) + 1);
  }
  const ranked = sentences.map((sentence, index) => {
    const score = (sentence.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).reduce((sum, token) => sum + (counts.get(token) || 0), 0);
    return { sentence, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 3).sort((a, b) => a.index - b.index);
  const decisions = sentences.filter((sentence) => /قرر|اتفق|اعتمد|تمت الموافقة|سنبدأ|نؤجل|اختار/i.test(sentence)).slice(0, 5);
  const tasks = sentences.filter((sentence) => /مهمة|إجراء|سوف|يجب|مطلوب|تابع|أرسل|جهز|راجع/i.test(sentence)).slice(0, 6);
  const questions = sentences.filter((sentence) => /[؟?]|هل |كيف |متى |لماذا /i.test(sentence)).slice(0, 5);
  return {
    summary: ranked.length ? ranked.map((item) => item.sentence).join(" ") : "لا يوجد نص كافٍ لإنتاج خلاصة محلية.",
    decisions,
    tasks,
    questions,
  };
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
    // تسوية خفيفة محلية تمنع التسجيل الهادئ جدًا من إرباك النموذج، من دون تغيير كلام المستخدم أو رفعه.
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
  const [draft, setDraft] = useState<MeetingSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<MeetingSession[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [policy,setPolicy]=useState<MeetingPolicy>(DEFAULT_POLICY);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const refreshSessions = async () => {
    try { setSavedSessions(await listMeetingSessions()); } catch { setNotice("تعذر قراءة الجلسات المحلية على هذا المتصفح."); }
  };

  useEffect(() => { void refreshSessions(); }, []);
  useEffect(()=>{let active=true;fetch("/api/meetings/policy",{cache:"no-store"}).then(response=>response.ok?response.json():DEFAULT_POLICY).then((next:MeetingPolicy)=>{if(active)setPolicy({...DEFAULT_POLICY,...next})}).catch(()=>{});return()=>{active=false}},[]);
  useEffect(()=>{if(!policy.baseModelEnabled&&model==="base")setModel("tiny");if(!policy.autoLanguageEnabled&&language==="auto")setLanguage("ar")},[policy,model,language]);
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    workerRef.current?.terminate();
  }, []);

  const finishCapture = (audio: Blob, durationMs: number) => {
    const next: MeetingSession = {
      id: draft?.id || newId(), title: title.trim() || "جلسة بلا عنوان", createdAt: new Date().toISOString(), durationMs,
      audio, transcript: "", segments: [], summary: "", decisions: [], tasks: [], questions: [], model: null,
    };
    setDraft(next); setElapsed(durationMs); setState("review"); setNotice("تم حفظ التسجيل داخل هذه الجلسة محليًا. اختر «تفريغ محلي» عندما تكون جاهزًا.");
  };

  const startRecording = async () => {
    if (!policy.enabled) { setNotice("ميزة التلخيص متوقفة مؤقتًا من إعدادات NAVIXA."); return; }
    if (policy.usageNoticeEnabled&&!consent) { setNotice("أكد أولًا أن لديك حق التسجيل وموافقة الحاضرين عند الحاجة."); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setNotice("لا يدعم هذا المتصفح التسجيل المحلي. جرّب متصفحًا حديثًا مثل Chrome أو Edge أو Safari."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        finishCapture(new Blob(chunksRef.current, { type }), Date.now() - startedAtRef.current);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null; recorderRef.current = null;
      };
      recorder.start(1000); recorderRef.current = recorder; streamRef.current = stream; startedAtRef.current = Date.now();
      setElapsed(0); setDraft(null); setState("recording"); setNotice("يتم التسجيل على جهازك فقط. أوقفه في أي وقت.");
      timerRef.current = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 250);
    } catch (error) {
      setNotice(error instanceof DOMException && error.name === "NotAllowedError" ? "لم تُمنح صلاحية الميكروفون. غيّرها من إعدادات المتصفح ثم حاول مجددًا." : "تعذر بدء التسجيل. تحقق من الميكروفون ثم حاول مجددًا.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
    setState("processing"); setNotice("جارٍ إنهاء ملف التسجيل محليًا…");
  };

  const importAudio = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (policy.usageNoticeEnabled&&!consent) { setNotice("أكد الموافقة قبل استيراد ملف صوت خاص."); return; }
    if (!file.type.startsWith("audio/")) { setNotice("اختر ملفًا صوتيًا صالحًا فقط."); return; }
    if (file.size > policy.maxFileMb * 1024 * 1024) { setNotice(`حجم الملف أكبر من الحد المحلي الحالي (${policy.maxFileMb}MB). قسّمه إلى جلسات أقصر.`); return; }
    finishCapture(file, 0); setNotice("تمت إضافة الملف محليًا. لن يُرفع إلى NAVIXA.");
  };

  const ensureWorker = () => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("./transcription.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;
      if (data.type === "progress") { setProgress(typeof data.percentage === "number" ? data.percentage : null); return; }
      if (data.type === "state") { setNotice(data.message || "جارٍ التحضير…"); return; }
      if (data.type === "error") { setState("review"); setProgress(null); setNotice(data.message || "تعذر التفريغ المحلي."); return; }
      if (data.type === "complete") {
        const transcript = data.transcript || "";
        const local = buildLocalSummary(transcript);
        setDraft((current) => current ? { ...current, transcript, segments: data.segments || [], summary: local.summary, decisions: local.decisions, tasks: local.tasks, questions: local.questions, model } : current);
        setProgress(null); setState("review"); setNotice("اكتمل التفريغ محليًا. راجع النص والملخص قبل الحفظ.");
      }
    };
    workerRef.current = worker; return worker;
  };

  const transcribe = async () => {
    if (!policy.enabled) { setNotice("ميزة التلخيص متوقفة مؤقتًا من إعدادات NAVIXA."); return; }
    if (!draft?.audio) { setNotice("أضف تسجيلًا أو ملفًا صوتيًا أولًا."); return; }
    try {
      setState("processing"); setProgress(0); setNotice("جارٍ تجهيز الصوت للتفريغ المحلي…");
      const audio = await decodeAndResample(draft.audio);
      const worker = ensureWorker();
      worker.postMessage({ type: "transcribe", audio, model, language }, [audio.buffer]);
    } catch { setState("review"); setProgress(null); setNotice("تعذر تجهيز الملف محليًا. جرّب ملفًا أقصر أو صيغة صوت أخرى."); }
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try { await saveMeetingSession({ ...draft, title: title.trim() || draft.title }); setDraft((current) => current ? { ...current, title: title.trim() || current.title } : current); await refreshSessions(); setNotice("حُفظت الجلسة داخل هذا الجهاز فقط."); }
    catch { setNotice("تعذر حفظ الجلسة محليًا. تأكد من مساحة التخزين في المتصفح."); }
    finally { setSaving(false); }
  };

  const eraseDraft = () => { setDraft(null); setElapsed(0); setState("ready"); setProgress(null); setNotice("تم حذف الجلسة الحالية من الذاكرة."); };
  const removeSaved = async (id: string) => { await deleteMeetingSession(id); await refreshSessions(); setNotice("تم حذف الجلسة من هذا الجهاز."); };
  const exportText = () => {
    if (!draft) return;
    const content = ["NAVIXA — سجّل ولخّص", NAVIXA_URL, "", `# ${draft.title}`, `التاريخ: ${new Date(draft.createdAt).toLocaleString("ar-SA")}`, "", "## الخلاصة", draft.summary || "لا يوجد ملخص بعد.", "", "## القرارات", ...(draft.decisions.length ? draft.decisions.map((value) => `- ${value}`) : ["- لا يوجد"]), "", "## المهام", ...(draft.tasks.length ? draft.tasks.map((value) => `- ${value}`) : ["- لا يوجد"]), "", "## النص الزمني", ...(draft.segments.length ? draft.segments.map((segment) => `[${formatMinute(segment.start)}] ${segment.text}`) : [draft.transcript || "لا يوجد نص بعد."]), "", `أُنشئ محليًا عبر NAVIXA · ${NAVIXA_URL}`].join("\n");
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
      const doc = new Document({ sections: [{ children: [
        new Paragraph({ children: [logo, new TextRun({ text: "  NAVIXA — سجّل ولخّص", bold: true, size: 30 })], alignment: AlignmentType.RIGHT }),
        new Paragraph({ children: [new TextRun({ text: NAVIXA_URL, color: "178F90", underline: {} })], alignment: AlignmentType.RIGHT }),
        new Paragraph({ text: draft.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.RIGHT }),
        new Paragraph({ text: `التاريخ: ${new Date(draft.createdAt).toLocaleString("ar-SA")} · أُنشئ محليًا على جهازك`, alignment: AlignmentType.RIGHT }),
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

  return <main className="meeting-page" dir="rtl">
    <header className="meeting-topbar">
      <Link className="meeting-back" href="/">← العودة للرئيسية</Link>
      <div className="meeting-identity"><img src="/navixa-mark.webp" alt="" /><div><small>NAVIXA LOCAL</small><h1>سجّل ولخّص</h1></div></div>
      <span className="meeting-beta">تجريبي · محلي</span>
    </header>

    <section className="meeting-hero">
      <div><small>محاضرات واجتماعات</small><h2>من أول دقيقة إلى آخر دقيقة، <em>على جهازك</em></h2><p>{policy.enabled?"سجّل بإذن واضح، ثم حوّل الصوت إلى نص وملخص قابل للمراجعة. لا يُرفع ملفك الصوتي إلى NAVIXA.":"الميزة متوقفة مؤقتًا من إعدادات NAVIXA. تبقى جلساتك المحفوظة محليًا على جهازك."}</p></div>
      <div className="meeting-hero-stats"><span>⌁ التسجيل بإذنك</span><span>◌ لا رفع افتراضي</span><span>↯ تحميل عند الطلب</span></div>
    </section>

    <section className="meeting-studio" aria-label="استوديو التلخيص المحلي">
      <div className="meeting-stage">
        <div className="meeting-stage-head"><div><small>{state === "recording" ? "● تسجيل محلي جارٍ" : state === "processing" ? "⌁ معالجة محلية" : "جلسة جديدة"}</small><h2>{state === "recording" ? formatDuration(elapsed) : draft ? draft.title : "لخّص محاضرة أو اجتماعًا"}</h2></div><span className={`meeting-state ${state}`}>{state === "recording" ? "● جاري" : state === "processing" ? "جارٍ التحضير" : draft ? "جاهز للمراجعة" : "لم يبدأ"}</span></div>
        {!draft && state !== "recording" && <div className="meeting-start-area">
          <div className="meeting-record-circle" aria-hidden="true">●</div>
          <p>لن نطلب إذن الميكروفون أو ننزّل أي نموذج قبل أن تبدأ أنت.</p>
          {policy.usageNoticeEnabled&&<label className="meeting-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>أؤكد أن لدي حق التسجيل، وأنني سأحصل على موافقة الحاضرين عند الحاجة.</span></label>}
          <div className="meeting-start-actions"><button type="button" className="meeting-primary" disabled={!policy.enabled} onClick={startRecording}>● ابدأ التسجيل</button><button type="button" className="meeting-secondary" disabled={!policy.enabled} onClick={() => audioInputRef.current?.click()}>↑ استورد ملفًا صوتيًا</button><input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={importAudio} /></div>
        </div>}
        {state === "recording" && <div className="meeting-recording-area"><div className="meeting-wave" aria-hidden="true">{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 17) % 54)}px` }} />)}</div><p>التسجيل ظاهر ومحلي. يمكنك الإيقاف في أي وقت.</p><button type="button" className="meeting-stop" onClick={stopRecording}>■ أوقف التسجيل</button></div>}
        {state === "processing" && <div className="meeting-processing"><div className="meeting-spinner" aria-hidden="true" /><p>{notice}</p>{progress !== null && <div className="meeting-progress"><i style={{ width: `${Math.max(3, progress)}%` }} /><span>{progress}%</span></div>}</div>}
        {draft && state === "review" && <div className="meeting-review-actions"><div><label>عنوان الجلسة<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label><small>المدة: {draft.durationMs ? formatDuration(draft.durationMs) : "ملف مستورد"}</small></div>          <div className="meeting-review-buttons"><button type="button" className="meeting-primary" onClick={transcribe} disabled={state === "processing"||!policy.enabled}>⌁ تفريغ محلي</button><button type="button" className="meeting-secondary" onClick={saveDraft} disabled={saving}>{saving ? "جارٍ الحفظ" : "حفظ على جهازي"}</button><button type="button" className="meeting-text-button" onClick={eraseDraft}>حذف الجلسة</button></div></div>}

        <p className="meeting-notice" role="status">{notice}</p>
      </div>

      <aside className="meeting-model-panel"><small>محرك محلي</small><h3>اختر الدقة واللغة قبل التنزيل</h3><p>يُنزل النموذج مرة واحدة إلى ذاكرة المتصفح عند أول تفريغ. بعد ذلك يعمل التفريغ محليًا من ذاكرة التخزين المتاحة.</p><label className={model === "tiny" ? "selected" : ""}><input type="radio" name="model" checked={model === "tiny"} onChange={() => setModel("tiny")} /><b>خفيف</b><span>تجربة أسرع، أدقّته أقل</span></label>{policy.baseModelEnabled&&<label className={model === "base" ? "selected" : ""}><input type="radio" name="model" checked={model === "base"} onChange={() => setModel("base")} /><b>متوازن</b><span>أبطأ وأكبر، مناسب للنص الأفضل</span></label>}<div className="meeting-language"><b>لغة الجلسة</b><div>{policy.autoLanguageEnabled&&<label className={language === "auto" ? "selected" : ""}><input type="radio" name="language" value="auto" checked={language === "auto"} onChange={() => setLanguage("auto")} />تلقائي عربي/English</label>}<label className={language === "ar" ? "selected" : ""}><input type="radio" name="language" value="ar" checked={language === "ar"} onChange={() => setLanguage("ar")} />العربية</label><label className={language === "en" ? "selected" : ""}><input type="radio" name="language" value="en" checked={language === "en"} onChange={() => setLanguage("en")} />English</label></div></div><div className="meeting-model-note">اختر «تلقائي» عند خلط العربية والإنجليزية. لا تفتح الصفحة النموذج، ولا تحمل أي مكتبة تفريغ، قبل الضغط على «تفريغ محلي».</div></aside>
    </section>

    {draft && state === "review" && <section className="meeting-output">
      <div className="meeting-print-brand"><img src="/navixa-export-logo.png" alt="NAVIXA" /><div><b>NAVIXA — سجّل ولخّص</b><a href={NAVIXA_URL}>{NAVIXA_URL}</a></div></div>
      <div className="meeting-output-head"><div><small>نتيجة محلية قابلة للتحرير</small><h2>الملخص والنص الزمني</h2></div><div className="meeting-export-actions"><button type="button" className="meeting-secondary" onClick={exportText}>↓ نص</button>{policy.exportPdfEnabled&&<button type="button" className="meeting-secondary" onClick={exportPdf}>↓ PDF</button>}{policy.exportWordEnabled&&<button type="button" className="meeting-secondary" onClick={() => void exportWord()}>↓ Word</button>}</div></div>
      <div className="meeting-output-grid">
        <section className="meeting-summary-pane"><label>الخلاصة<textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="سيظهر هنا ملخص محلي بعد التفريغ…" /></label><div className="meeting-lists"><div><h3>قرارات</h3>{draft.decisions.length ? draft.decisions.map((item, index) => <p key={`${item}-${index}`}>✓ {item}</p>) : <p className="empty">ستظهر القرارات المحتملة هنا بعد التفريغ.</p>}</div><div><h3>مهام</h3>{draft.tasks.length ? draft.tasks.map((item, index) => <p key={`${item}-${index}`}>→ {item}</p>) : <p className="empty">ستظهر المهام المحتملة هنا بعد التفريغ.</p>}</div></div></section>
        <section className="meeting-transcript-pane"><label>النص الزمني<textarea value={draft.transcript} onChange={(event) => { const next = event.target.value; const local = buildLocalSummary(next); setDraft({ ...draft, transcript: next, summary: local.summary, decisions: local.decisions, tasks: local.tasks, questions: local.questions }); }} placeholder="سيظهر النص هنا بعد التفريغ…" /></label><div className="meeting-timeline">{draft.segments.length ? draft.segments.slice(0, 8).map((segment, index) => <button type="button" key={`${segment.start}-${index}`} onClick={() => setNotice(`المقطع عند ${formatMinute(segment.start)} محفوظ داخل النص المحلي.`)}><time>{formatMinute(segment.start)}</time><span>{segment.text}</span></button>) : <p>لا توجد طوابع زمنية بعد.</p>}</div></section>
      </div>
    </section>}

    <section className="meeting-library"><div><small>على هذا الجهاز فقط</small><h2>جلساتك المحفوظة</h2></div>{savedSessions.length ? <div className="meeting-library-list">{savedSessions.slice(0, 8).map((session) => <article key={session.id}><div><b>{session.title}</b><small>{new Date(session.createdAt).toLocaleDateString("ar-SA")} · {session.transcript ? "نص محفوظ" : "تسجيل محفوظ"}</small></div><div><button type="button" onClick={() => { setDraft(session); setTitle(session.title); setElapsed(session.durationMs); setState("review"); setNotice("فُتحت الجلسة من تخزين هذا الجهاز."); }}>فتح</button><button type="button" className="danger" onClick={() => void removeSaved(session.id)}>حذف</button></div></article>)}</div> : <p className="meeting-library-empty">لا توجد جلسات محفوظة. ستبقى الجلسات التي تحفظها داخل متصفحك على هذا الجهاز.</p>}</section>
  </main>;
}
