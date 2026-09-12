"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createNavixaBrowserVoiceEngine, type NavixaVoiceEngine, type NavixaVoiceLanguage } from "../voice/voiceEngine";
import { findNavixaVoiceTerm, type NavixaVoiceMatch } from "../voice/voiceDetection";
import { hasNavixaVoiceActivity } from "../voice/localNameFallback";
import {
  createControlledLiveNameSenseTrial,
  deriveNameSenseAdaptiveVadThreshold,
  isNameSenseNoiseFloorCandidate,
} from "../../benchmarks/namesense/collector-core.mjs";
import protocolJson from "../../benchmarks/namesense/protocol.json";
import "./study.css";

type Accent = "en-IN" | "en-PH" | "en-US" | "en-GB" | "ar-GULF" | "ar-EG" | "ar-SY" | "ar-MA" | "ar-DZ";
type DeviceClass = "laptop-built-in" | "headset" | "phone";
type BrowserClass = "desktop-chromium" | "ios-safari";
type NoiseClass = "clean" | "office-background" | "lecture-echo";
type NameId = "sultan" | "mohammed" | "alharbi";
type Expected = "hit" | "miss";
type Prompt = { id: string; text: string; latencyEligible: boolean };
type StudySession = {
  accent: Accent;
  speakerId: string;
  remainingTrials: number;
  maxTrials: number;
  expiresAt: string;
  nextExpected: Expected;
  nextNameId: NameId;
};

type BenchmarkProtocol = {
  requiredProvenance: "controlled-live";
  requiredCaptureMethod: "live-microphone";
  signalQuality: { minRms: number; minVariance: number; minActiveSpeechMs: number; frameMs: number };
  latency: { boundary: "client-vad-name-end-to-alert" };
};

const protocol = protocolJson as BenchmarkProtocol;
const INVITE_SESSION_KEY = "navixa-ns-study-invite";
const HEX_64 = /^[a-f0-9]{64}$/i;

const ACCENT_LABELS: Record<Accent, string> = {
  "en-IN": "English · Indian",
  "en-PH": "English · Filipino",
  "en-US": "English · American",
  "en-GB": "English · British",
  "ar-GULF": "العربية · خليجي",
  "ar-EG": "العربية · مصري",
  "ar-SY": "العربية · سوري",
  "ar-MA": "العربية · مغربي",
  "ar-DZ": "العربية · جزائري",
};

const NAMES: Record<NameId, { ar: string; en: string }> = {
  sultan: { ar: "سلطان", en: "Sultan" },
  mohammed: { ar: "محمد", en: "Mohammed" },
  alharbi: { ar: "الحربي", en: "Alharbi" },
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
const defaultDeviceClass = (): DeviceClass => typeof navigator !== "undefined" && /Mobile|Android|iP(?:hone|ad|od)/.test(navigator.userAgent) ? "phone" : "laptop-built-in";
const nextIndex = (length: number) => Math.floor(Math.random() * Math.max(1, length));
const randomHex = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

const browserClass = (): BrowserClass | null => {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const iosSafari = /iP(?:hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/(?:CriOS|FxiOS|EdgiOS)/.test(ua);
  if (iosSafari) return "ios-safari";
  if (!/Mobile|Android|iP(?:hone|ad|od)/.test(ua) && /(?:Chrome|Chromium|Edg)\//.test(ua)) return "desktop-chromium";
  return null;
};

function buildPrompt(accent: Accent, nameId: NameId, expected: Expected): Prompt {
  const arabic = accent.startsWith("ar-");
  const name = arabic ? NAMES[nameId].ar : NAMES[nameId].en;
  if (expected === "hit") {
    const item = POSITIVE_TEMPLATES[nextIndex(POSITIVE_TEMPLATES.length)];
    const template = arabic ? item.ar : item.en;
    return {
      id: `${item.id}-${nameId}`,
      text: template.replaceAll("{name}", name).replaceAll("{latinName}", NAMES[nameId].en),
      latencyEligible: item.latencyEligible,
    };
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

export default function NameSenseStudyPage() {
  const [invite, setInvite] = useState("");
  const [clientNonce, setClientNonce] = useState("");
  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [deviceClass, setDeviceClass] = useState<DeviceClass>(() => defaultDeviceClass());
  const [noise, setNoise] = useState<NoiseClass>("clean");
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("جاهز");
  const [lastResult, setLastResult] = useState("");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const mounted = useRef(true);
  const detectedBrowser = useMemo(() => browserClass(), []);

  const loadSession = useCallback(async (token: string, nonce: string) => {
    setLoading(true); setPageError("");
    try {
      const response = await fetch("/api/namesense-study", {
        method: "PUT",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invite: token, clientNonce: nonce }),
      });
      const data = await response.json().catch(() => ({})) as StudySession & { error?: string };
      if (!response.ok) throw new Error(data.error || "تعذر فتح جلسة المشاركة");
      if (mounted.current) setSession(data);
    } catch (error) {
      if (mounted.current) setPageError(error instanceof Error ? error.message : "تعذر فتح جلسة المشاركة");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const fragmentToken = fragment.get("invite")?.trim().toLowerCase() || "";
    const storedToken = sessionStorage.getItem(INVITE_SESSION_KEY)?.trim().toLowerCase() || "";
    const token = HEX_64.test(fragmentToken) ? fragmentToken : HEX_64.test(storedToken) ? storedToken : "";

    if (fragmentToken) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (!token) {
      setLoading(false);
      setPageError("رابط المشاركة ناقص أو غير صالح");
      return () => { mounted.current = false; };
    }

    sessionStorage.setItem(INVITE_SESSION_KEY, token);
    const clientKey = `navixa-ns-study-client:${token.slice(0, 16)}`;
    const storedNonce = localStorage.getItem(clientKey)?.trim().toLowerCase() || "";
    const nonce = HEX_64.test(storedNonce) ? storedNonce : randomHex();
    if (!HEX_64.test(storedNonce)) localStorage.setItem(clientKey, nonce);

    setInvite(token);
    setClientNonce(nonce);
    void loadSession(token, nonce);
    return () => { mounted.current = false; };
  }, [loadSession]);

  useEffect(() => {
    if (!running && session && session.remainingTrials > 0) {
      setPrompt(buildPrompt(session.accent, session.nextNameId, session.nextExpected));
    }
  }, [running, session]);

  const runTrial = async () => {
    if (running || !session || !prompt || !invite || !clientNonce) return;
    if (!consent) { setStatus("أكد موافقتك أولًا"); return; }
    if (!detectedBrowser) { setStatus("هذا المتصفح خارج مجموعة القياس الحالية"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("الميكروفون غير مدعوم في هذا المتصفح"); return; }

    const trialSession = session;
    const trialPrompt = prompt;
    const watchedTerm = trialSession.accent.startsWith("ar-") ? NAMES[trialSession.nextNameId].ar : NAMES[trialSession.nextNameId].en;

    setRunning(true); setLastResult(""); setStatus("اقرأ الجملة الآن بصوت طبيعي…");
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
            id: `trial-${crypto.randomUUID()}`, split: "holdout", accent: trialSession.accent, speakerId: trialSession.speakerId,
            watchedNameId: trialSession.nextNameId, promptId: trialPrompt.id, deviceClass, browser: detectedBrowser, noise,
            expected: trialSession.nextExpected, detected: detectedAt !== null, latencyEligible: trialPrompt.latencyEligible, latencyMs,
            latencyBoundary: protocol.latency.boundary, consent: true, matchMethod: match?.method || null, matchScore: match?.score ?? null,
          },
        });
        audio.fill(0);
        const response = await fetch("/api/namesense-study", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ invite, clientNonce, trial: record }),
        });
        const data = await response.json().catch(() => ({})) as {
          error?: string; remainingTrials?: number; nextExpected?: Expected; nextNameId?: NameId; completed?: boolean; refreshRequired?: boolean;
        };
        if (!response.ok) {
          if (data.refreshRequired) void loadSession(invite, clientNonce);
          throw new Error(data.error || "تعذر اعتماد التجربة");
        }
        if (mounted.current) {
          const remainingTrials = Number(data.remainingTrials ?? 0);
          setSession((current) => current ? {
            ...current,
            remainingTrials,
            nextExpected: data.nextExpected || current.nextExpected,
            nextNameId: data.nextNameId || current.nextNameId,
          } : current);
          setLastResult(detectedAt !== null ? "تم تسجيل نتيجة الالتقاط" : "تم تسجيل عدم الالتقاط");
          setStatus(data.completed ? "اكتملت مشاركتك. شكرًا لك." : "حُفظت النتيجة فقط، وتم التخلص من الصوت الخام");
        }
      } catch (error) {
        audio.fill(0);
        if (mounted.current) { setStatus(error instanceof Error ? error.message : "تعذر اعتماد التجربة"); setLastResult("لم تُحتسب هذه الجولة"); }
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
        language: accentLanguage(trialSession.accent),
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
          onError: (message) => { if (message !== "no-speech") setStatus(`تعذر الاستماع: ${message}`); },
        },
      });
      if (!engine.supported || !engine.start()) throw new Error("تعذر تشغيل NameSense في هذا المتصفح");
      processor.onaudioprocess = (event) => {
        if (finished || !context) return;
        const input = new Float32Array(event.inputBuffer.getChannelData(0));
        chunks.push(input); bufferedSamples += input.length;
        const frameRms = rmsOf(input);
        if (!speechSeen && noiseFloorFrames < 30 && isNameSenseNoiseFloorCandidate(frameRms, protocol.signalQuality.minRms)) {
          noiseFloorRms = (noiseFloorRms * noiseFloorFrames + frameRms) / (noiseFloorFrames + 1);
          noiseFloorFrames += 1;
        }
        const adaptiveRmsThreshold = deriveNameSenseAdaptiveVadThreshold(noiseFloorRms, protocol.signalQuality.minRms);
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
      setStatus(error instanceof Error ? error.message : "تعذر بدء التجربة"); setLastResult("لم تُحتسب هذه الجولة"); void finish("error");
    }
  };

  if (loading) return <main className="namesense-study" dir="rtl"><section className="study-shell study-state"><div className="study-spinner" /><p>يتم التحقق من رابط المشاركة…</p></section></main>;
  if (pageError || !session) return <main className="namesense-study" dir="rtl"><section className="study-shell study-state"><span className="study-mark">NAVIXA</span><h1>تعذر فتح المشاركة</h1><p>{pageError || "الرابط غير صالح"}</p></section></main>;

  const completed = session.remainingTrials <= 0;
  const completedCount = session.maxTrials - session.remainingTrials;
  const progress = Math.min(100, Math.max(0, Math.round((completedCount / session.maxTrials) * 100)));

  return <main className="namesense-study" dir="rtl">
    <section className="study-shell">
      <header className="study-header"><span className="study-mark">NAVIXA</span><span className="study-badge">NameSense study</span></header>
      <div className="study-hero">
        <small>اختبار بشري محكوم</small>
        <h1>{completed ? "اكتملت مشاركتك" : "ساعدنا نخلي NAVIXA يسمع الاسم بدقة أعلى"}</h1>
        <p>{completed ? "شكرًا لمساهمتك. لا نحتاج أي خطوة إضافية." : "ستقرأ جملًا قصيرة بصوتك الطبيعي. الصوت يُحلل لحظيًا على جهازك ثم يُتلف؛ لا نرفع التسجيل الخام ولا نحفظ التفريغ النصي."}</p>
      </div>

      <div className="study-progress" aria-label={`اكتمل ${progress}%`}><span style={{ width: `${progress}%` }} /></div>
      <div className="study-progress-copy"><b>{completedCount}</b><span>من {session.maxTrials} جولة</span><em>{ACCENT_LABELS[session.accent]}</em></div>

      {!completed && <>
        <section className="study-card study-settings">
          <h2>قبل البداية</h2>
          <div className="study-grid">
            <label>نوع الميكروفون<select value={deviceClass} disabled={running} onChange={(event) => setDeviceClass(event.target.value as DeviceClass)}><option value="laptop-built-in">مايك الكمبيوتر</option><option value="headset">سماعة / Headset</option><option value="phone">مايك الجوال</option></select></label>
            <label>البيئة المحيطة<select value={noise} disabled={running} onChange={(event) => setNoise(event.target.value as NoiseClass)}><option value="clean">هادئة</option><option value="office-background">أصوات خلفية خفيفة</option><option value="lecture-echo">صدى / قاعة</option></select></label>
          </div>
          <p className={detectedBrowser ? "study-ok" : "study-warn"}>{detectedBrowser ? "المتصفح ضمن مجموعة القياس المعتمدة" : "هذا المتصفح غير مدعوم في القياس الحالي. استخدم Safari على iPhone/iPad أو Chrome/Edge على الكمبيوتر."}</p>
          <label className="study-consent"><input type="checkbox" checked={consent} disabled={running} onChange={(event) => setConsent(event.target.checked)} /><span>أوافق على المشاركة وأفهم أن NAVIXA يحفظ نتيجة القياس المجهولة فقط، ولا يحتفظ بالصوت الخام أو التفريغ النصي أو بيانات حسابي.</span></label>
        </section>

        <section className="study-card study-trial">
          <span className="study-kicker">الجولة التالية</span>
          <h2>اقرأ الجملة كما تنطقها عادة</h2>
          <div className="study-prompt" aria-live="polite">{prompt?.text || "…"}</div>
          <button type="button" className="study-primary" disabled={running || !consent || !detectedBrowser || !prompt} onClick={() => void runTrial()}>{running ? "يستمع الآن…" : "ابدأ واستعد للقراءة"}</button>
          <div className="study-status" aria-live="polite"><b>{status}</b>{lastResult && <span>{lastResult}</span>}</div>
        </section>
      </>}

      <footer className="study-footer"><span>خصوصيتك جزء من الاختبار، وليست إضافة جانبية.</span><small>ينتهي رابط المشاركة تلقائيًا ولا يمنح أي صلاحية داخل NAVIXA.</small></footer>
    </section>
  </main>;
}
