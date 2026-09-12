"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createNavixaBrowserVoiceEngine, type NavixaVoiceEngine, type NavixaVoiceLanguage } from "../../voice/voiceEngine";
import { findNavixaVoiceTerm, type NavixaVoiceMatch } from "../../voice/voiceDetection";
import { hasNavixaVoiceActivity } from "../../voice/localNameFallback";
import {
  createControlledLiveNameSenseTrial,
  deriveNameSenseAdaptiveVadThreshold,
  isNameSenseNoiseFloorCandidate,
} from "../../../benchmarks/namesense/collector-core.mjs";
import protocolJson from "../../../benchmarks/namesense/protocol.json";
import { useAdminAuth } from "../useAdminAuth";
import "./collector.css";

type Accent = "en-IN" | "en-PH" | "en-US" | "en-GB" | "ar-GULF" | "ar-EG" | "ar-SY" | "ar-MA" | "ar-DZ";
type DeviceClass = "laptop-built-in" | "headset" | "phone";
type BrowserClass = "desktop-chromium" | "ios-safari";
type NoiseClass = "clean" | "office-background" | "lecture-echo";
type NameId = "sultan" | "mohammed" | "alharbi";
type Expected = "hit" | "miss";
type Prompt = { id: string; text: string; latencyEligible: boolean };
type AccentSummary = { accent: string; trials: number; speakers: number; positives: number; negatives: number; tp: number; fn: number; fp: number; tn: number };

type BenchmarkProtocol = {
  requiredProvenance: "controlled-live";
  requiredCaptureMethod: "live-microphone";
  signalQuality: { minRms: number; minVariance: number; minActiveSpeechMs: number; frameMs: number };
  latency: { boundary: "client-vad-name-end-to-alert" };
};

const protocol = protocolJson as BenchmarkProtocol;

const ACCENTS: Array<{ id: Accent; label: string }> = [
  { id: "en-IN", label: "English · Indian" },
  { id: "en-PH", label: "English · Filipino" },
  { id: "en-US", label: "English · American" },
  { id: "en-GB", label: "English · British" },
  { id: "ar-GULF", label: "العربية · خليجي" },
  { id: "ar-EG", label: "العربية · مصري" },
  { id: "ar-SY", label: "العربية · سوري" },
  { id: "ar-MA", label: "العربية · مغربي" },
  { id: "ar-DZ", label: "العربية · جزائري" },
];

const NAMES: Record<NameId, { ar: string; en: string; label: string }> = {
  sultan: { ar: "سلطان", en: "Sultan", label: "سلطان · Sultan" },
  mohammed: { ar: "محمد", en: "Mohammed", label: "محمد · Mohammed" },
  alharbi: { ar: "الحربي", en: "Alharbi", label: "الحربي · Alharbi" },
};

const POSITIVE_TEMPLATES = [
  { id: "name-only", ar: "{name}", en: "{name}", latencyEligible: true },
  { id: "direct-question", ar: "يا {name} تسمعني؟", en: "{name}, can you hear me?", latencyEligible: false },
  { id: "classroom-answer", ar: "{name} جاوب على السؤال لو سمحت", en: "{name}, answer the question please", latencyEligible: false },
  { id: "mid-sentence", ar: "السؤال الجاي عند {name} وبعده نكمل", en: "The next question is for {name}, then we continue", latencyEligible: false },
  { id: "name-final", ar: "نحتاج إجابتك الآن يا {name}", en: "We need your answer now, {name}", latencyEligible: true },
  { id: "code-switch", ar: "يا {latinName} are you with us?", en: "{latinName} جاوب لو سمحت", latencyEligible: false },
  { id: "repeat-name", ar: "{name}، {name}، تسمعني؟", en: "{name}, {name}, can you hear me?", latencyEligible: false },
] as const;

const NEGATIVES: Record<NameId, { ar: string[]; en: string[] }> = {
  sultan: {
    ar: ["يا سلمان جاوب على السؤال", "سليم موجود معنا؟", "نكمل السؤال التالي بدون أسماء"],
    en: ["Please ask Salman now", "Please ask Salim now", "Please ask Zoltan now", "Please ask Shelton now", "Please ask Sullivan now", "The sultanate announced a change"],
  },
  mohammed: {
    ar: ["يا محمود جاوب على السؤال", "حمد موجود معنا؟", "نكمل السؤال التالي بدون أسماء"],
    en: ["Please ask Mahmoud to answer", "Please ask Hamad to answer", "Let's continue with the next slide"],
  },
  alharbi: {
    ar: ["الحارثي موجود؟", "نحتاج إجابة الطالب التالي الآن", "نكمل السؤال التالي بدون أسماء"],
    en: ["Next is Al Hardy", "Please ask Al Harithy now", "Let's continue with the next slide"],
  },
};

const accentLanguage = (accent: Accent): NavixaVoiceLanguage => accent === "ar-GULF" ? "ar-SA" : accent as NavixaVoiceLanguage;

const browserClass = (): BrowserClass | null => {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const iosSafari = /iP(?:hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/(?:CriOS|FxiOS|EdgiOS)/.test(ua);
  if (iosSafari) return "ios-safari";
  if (!/Mobile|Android|iP(?:hone|ad|od)/.test(ua) && /(?:Chrome|Chromium|Edg)\//.test(ua)) return "desktop-chromium";
  return null;
};

const defaultDeviceClass = (): DeviceClass => typeof navigator !== "undefined" && /Mobile|Android|iP(?:hone|ad|od)/.test(navigator.userAgent) ? "phone" : "laptop-built-in";
const nextIndex = (length: number) => Math.floor(Math.random() * Math.max(1, length));

function buildPrompt(accent: Accent, nameId: NameId, expected: Expected): Prompt {
  const arabic = accent.startsWith("ar-");
  const name = arabic ? NAMES[nameId].ar : NAMES[nameId].en;
  if (expected === "hit") {
    const item = POSITIVE_TEMPLATES[nextIndex(POSITIVE_TEMPLATES.length)];
    const template = arabic ? item.ar : item.en;
    return { id: `${item.id}-${nameId}`, text: template.replaceAll("{name}", name).replaceAll("{latinName}", NAMES[nameId].en), latencyEligible: item.latencyEligible };
  }
  const candidates = arabic ? NEGATIVES[nameId].ar : NEGATIVES[nameId].en;
  const index = nextIndex(candidates.length);
  return { id: `negative-${nameId}-${index + 1}`, text: candidates[index], latencyEligible: false };
}

const flatten = (chunks: Float32Array[]) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
};

const rmsOf = (input: Float32Array) => {
  if (!input.length) return 0;
  let sumSquares = 0;
  for (const raw of input) {
    const sample = Number.isFinite(raw) ? raw : 0;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / input.length);
};

export default function NameSenseBenchmarkCollector() {
  const { allowed, checking } = useAdminAuth();
  const [accent, setAccent] = useState<Accent>("en-IN");
  const [nameId, setNameId] = useState<NameId>("sultan");
  const [expected, setExpected] = useState<Expected>("hit");
  const [deviceClass, setDeviceClass] = useState<DeviceClass>(() => defaultDeviceClass());
  const [noise, setNoise] = useState<NoiseClass>("clean");
  const [speakerId, setSpeakerId] = useState("");
  const [consent, setConsent] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(() => buildPrompt("en-IN", "sultan", "hit"));
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("جاهز لجلسة بشرية محكومة");
  const [lastResult, setLastResult] = useState("");
  const [sessionTrials, setSessionTrials] = useState(0);
  const [summary, setSummary] = useState<AccentSummary[]>([]);
  const mounted = useRef(true);
  const detectedBrowser = useMemo(() => browserClass(), []);

  const refreshSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/namesense-benchmark", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json() as { accents?: AccentSummary[] };
      if (mounted.current) setSummary(Array.isArray(data.accents) ? data.accents : []);
    } catch {}
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!speakerId) setSpeakerId(`anon-${crypto.randomUUID()}`);
    void refreshSummary();
    return () => { mounted.current = false; };
  }, [refreshSummary, speakerId]);

  useEffect(() => { if (!running) setPrompt(buildPrompt(accent, nameId, expected)); }, [accent, nameId, expected, running]);

  const newSpeaker = () => {
    if (running) return;
    setSpeakerId(`anon-${crypto.randomUUID()}`);
    setSessionTrials(0);
    setConsent(false);
    setLastResult("");
    setStatus("معرّف مجهول جديد؛ اختر اللهجة وأكد الموافقة");
  };

  const runTrial = async () => {
    if (running) return;
    if (!consent) { setStatus("أكد موافقة المتحدث قبل بدء التجربة"); return; }
    if (!detectedBrowser) { setStatus("هذا المتصفح خارج مجموعات benchmark المعتمدة حاليًا"); return; }
    if (!speakerId.startsWith("anon-")) { setStatus("معرّف المتحدث غير مجهول الهوية"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("الميكروفون غير مدعوم في هذا المتصفح"); return; }

    const trialAccent = accent, trialNameId = nameId, trialExpected = expected, trialPrompt = prompt, trialSpeaker = speakerId;
    const watchedTerm = trialAccent.startsWith("ar-") ? NAMES[trialNameId].ar : NAMES[trialNameId].en;

    setRunning(true); setLastResult(""); setStatus("استمع الآن للجملة المعروضة…");
    let stream: MediaStream | null = null, context: AudioContext | null = null, source: MediaStreamAudioSourceNode | null = null, processor: ScriptProcessorNode | null = null, engine: NavixaVoiceEngine | null = null;
    let hardTimer: number | null = null, endpointTimer: number | null = null, finished = false, detectedAt: number | null = null, endpointAt: number | null = null, match: NavixaVoiceMatch | null = null;
    let bufferedSamples = 0, speechSeen = false, trailingSilenceSamples = 0;
    let noiseFloorRms = protocol.signalQuality.minRms * 0.5, noiseFloorFrames = 0;
    const chunks: Float32Array[] = [];

    const cleanup = () => {
      if (hardTimer !== null) window.clearTimeout(hardTimer);
      if (endpointTimer !== null) window.clearTimeout(endpointTimer);
      engine?.destroy();
      if (processor) { processor.onaudioprocess = null; try { processor.disconnect(); } catch {} }
      if (source) { try { source.disconnect(); } catch {} }
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== "closed") void context.close().catch(() => undefined);
    };

    const finish = async (reason: "endpoint" | "timeout" | "error") => {
      if (finished) return;
      finished = true;
      const sampleRate = context?.sampleRate || 16_000;
      cleanup();
      if (reason === "error") { for (const chunk of chunks) chunk.fill(0); if (mounted.current) setRunning(false); return; }
      const audio = flatten(chunks);
      for (const chunk of chunks) chunk.fill(0);
      const latencyMs = trialPrompt.latencyEligible && detectedAt !== null && endpointAt !== null ? Math.max(0, Math.round(detectedAt - endpointAt)) : null;
      try {
        const record = createControlledLiveNameSenseTrial({
          audio, sampleRate, protocol,
          trial: {
            id: `trial-${crypto.randomUUID()}`, split: "holdout", accent: trialAccent, speakerId: trialSpeaker,
            watchedNameId: trialNameId, promptId: trialPrompt.id, deviceClass, browser: detectedBrowser, noise,
            expected: trialExpected, detected: detectedAt !== null, latencyEligible: trialPrompt.latencyEligible, latencyMs,
            latencyBoundary: protocol.latency.boundary, consent: true, matchMethod: match?.method || null, matchScore: match?.score ?? null,
          },
        });
        audio.fill(0);
        const response = await fetch("/api/admin/namesense-benchmark", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(record) });
        const data = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(data.error || "تعذر حفظ التجربة");
        if (mounted.current) {
          setSessionTrials((count) => count + 1);
          setLastResult(detectedAt !== null ? `التقط الاسم · ${match?.method || "match"}${latencyMs !== null ? ` · ${latencyMs}ms` : ""}` : "لم يلتقط الاسم");
          setStatus("حُفظت النتيجة فقط؛ تم التخلص من الصوت الخام");
          setExpected((current) => current === "hit" ? "miss" : "hit");
          void refreshSummary();
        }
      } catch (error) {
        audio.fill(0);
        if (mounted.current) { setStatus(error instanceof Error ? error.message : "تعذر اعتماد التجربة"); setLastResult("لم تُحتسب التجربة"); }
      } finally { if (mounted.current) setRunning(false); }
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("AudioContext غير مدعوم");
      context = new AudioContextClass();
      if (context.state === "suspended") await context.resume();
      source = context.createMediaStreamSource(stream);
      processor = context.createScriptProcessor(4096, 1, 1);
      engine = createNavixaBrowserVoiceEngine({
        language: accentLanguage(trialAccent),
        continuous: true,
        interimResults: true,
        localAccuracyFallback: true,
        adaptiveLanguage: true,
        mediaStream: stream,
        contextualBiasTerms: watchedTerm,
        learningEnabled: false,
        useStoredLanguageHint: false,
        persistLanguageHint: false,
        handlers: {
          onTranscript: ({ text }) => {
            if (detectedAt !== null) return;
            const found = findNavixaVoiceTerm(text, [watchedTerm]);
            if (!found) return;
            detectedAt = performance.now(); match = found;
          },
          onError: (message) => { if (message !== "no-speech") setStatus(`خطأ الاستماع: ${message}`); },
        },
      });
      if (!engine.supported || !engine.start()) throw new Error("تعذر تشغيل محرك NameSense في هذا المتصفح");
      processor.onaudioprocess = (event) => {
        if (finished || !context) return;
        const input = new Float32Array(event.inputBuffer.getChannelData(0));
        chunks.push(input); bufferedSamples += input.length;
        const frameRms = rmsOf(input);
        if (!speechSeen && noiseFloorFrames < 30 && isNameSenseNoiseFloorCandidate(frameRms, protocol.signalQuality.minRms)) {
          noiseFloorRms = (noiseFloorRms * noiseFloorFrames + frameRms) / (noiseFloorFrames + 1);
          noiseFloorFrames += 1;
        }
        const adaptiveRmsThreshold = deriveNameSenseAdaptiveVadThreshold(
          noiseFloorRms,
          protocol.signalQuality.minRms,
        );
        const hasVoice = hasNavixaVoiceActivity(input, context.sampleRate, 20, adaptiveRmsThreshold, 60);
        if (hasVoice) { speechSeen = true; trailingSilenceSamples = 0; } else if (speechSeen) trailingSilenceSamples += input.length;
        for (let channel = 0; channel < event.outputBuffer.numberOfChannels; channel += 1) event.outputBuffer.getChannelData(channel).fill(0);
        if (endpointAt === null && speechSeen && bufferedSamples >= context.sampleRate * 0.8 && trailingSilenceSamples >= context.sampleRate * 0.4) {
          endpointAt = performance.now() - (trailingSilenceSamples / context.sampleRate) * 1000;
          endpointTimer = window.setTimeout(() => { void finish("endpoint"); }, 1_800);
        }
      };
      source.connect(processor); processor.connect(context.destination);
      hardTimer = window.setTimeout(() => { void finish("timeout"); }, 10_000);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر بدء التجربة"); setLastResult("لم تُحتسب التجربة"); void finish("error");
    }
  };

  if (checking || !allowed) return null;

  return <main className="namesense-lab" dir="rtl">
    <header className="namesense-lab__top"><a href="/admin">← لوحة الإدارة</a><span>مختبر داخلي · NameSense</span></header>
    <section className="namesense-lab__hero">
      <div><small>Human holdout benchmark</small><h1>اختبار التقاط الاسم بصوت بشري حقيقي</h1><p>الميكروفون يُحلل محليًا. لا يُرفع أو يُحفظ الصوت الخام ولا التفريغ النصي؛ يُحفظ فقط ناتج القياس المجهول.</p></div>
      <div className="namesense-lab__session"><b>{sessionTrials}</b><span>تجارب هذا المتحدث في الجلسة</span></div>
    </section>
    <section className="namesense-lab__grid">
      <article className="namesense-card">
        <h2>1. تعريف المجموعة</h2>
        <label>اللهجة أو اللكنة كما يعرّفها المتحدث<select value={accent} disabled={running || sessionTrials > 0} onChange={(event) => setAccent(event.target.value as Accent)}>{ACCENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>معرّف مجهول<input value={speakerId} readOnly dir="ltr" /></label>
        <button className="secondary" type="button" disabled={running} onClick={newSpeaker}>متحدث جديد</button>
        <label>الجهاز أو الميكروفون<select value={deviceClass} disabled={running} onChange={(event) => setDeviceClass(event.target.value as DeviceClass)}><option value="laptop-built-in">كمبيوتر · مايك مدمج</option><option value="headset">سماعة / Headset</option><option value="phone">جوال</option></select></label>
        <label>البيئة الصوتية<select value={noise} disabled={running} onChange={(event) => setNoise(event.target.value as NoiseClass)}><option value="clean">هادئة</option><option value="office-background">مكتب / أصوات خلفية</option><option value="lecture-echo">قاعة / صدى محاضرة</option></select></label>
        <p className={detectedBrowser ? "namesense-ok" : "namesense-warn"}>{detectedBrowser ? `المتصفح المعتمد: ${detectedBrowser}` : "هذا المتصفح غير داخل مجموعات الاعتماد الحالية"}</p>
      </article>
      <article className="namesense-card namesense-card--prompt">
        <h2>2. التجربة الحالية</h2>
        <div className="namesense-inline">
          <label>الاسم المستهدف<select value={nameId} disabled={running} onChange={(event) => setNameId(event.target.value as NameId)}>{Object.entries(NAMES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
          <label>نوع التجربة<select value={expected} disabled={running} onChange={(event) => setExpected(event.target.value as Expected)}><option value="hit">إيجابية · يجب التقاط الاسم</option><option value="miss">سلبية · يجب ألا يتنبه</option></select></label>
        </div>
        <div className="namesense-prompt" aria-live="polite"><small>{trialLabel(expected, prompt.latencyEligible)}</small><strong>{prompt.text}</strong></div>
        <label className="namesense-consent"><input type="checkbox" checked={consent} disabled={running} onChange={(event) => setConsent(event.target.checked)} /><span>وافق المتحدث على هذه التجربة، ويفهم أن الصوت يُستخدم لحظيًا ثم يُتلف ولا يُخزن.</span></label>
        <button className="primary" type="button" disabled={running || !consent || !detectedBrowser} onClick={() => void runTrial()}>{running ? "يستمع الآن…" : "ابدأ التجربة"}</button>
        <button className="secondary" type="button" disabled={running} onClick={() => setPrompt(buildPrompt(accent, nameId, expected))}>جملة أخرى</button>
        <div className="namesense-status" aria-live="polite"><b>{status}</b>{lastResult && <span>{lastResult}</span>}</div>
      </article>
    </section>
    <section className="namesense-card namesense-summary">
      <div><small>Evidence progress</small><h2>تقدم العينة البشرية</h2><p>هذه الأرقام حجم العينة فقط، وليست دقة NameSense. الاعتماد النهائي يتم بالـscorer الصارم بعد اكتمال الحد الأدنى والتوازن.</p></div>
      <div className="namesense-summary__table" role="table" aria-label="تقدم benchmark حسب اللهجة">
        <div className="namesense-row namesense-row--head" role="row"><span>المجموعة</span><span>متحدثون</span><span>+</span><span>−</span></div>
        {ACCENTS.map((item) => { const row = summary.find((entry) => entry.accent === item.id); return <div className="namesense-row" role="row" key={item.id}><span>{item.label}</span><span>{row?.speakers || 0}/25</span><span>{row?.positives || 0}/500</span><span>{row?.negatives || 0}/500</span></div>; })}
      </div>
    </section>
  </main>;
}

function trialLabel(expected: Expected, latencyEligible: boolean) {
  if (expected === "miss") return "اختبار إنذار كاذب · يجب ألا يلتقط الاسم";
  return latencyEligible ? "اختبار التقاط + زمن استجابة" : "اختبار التقاط الاسم";
}
