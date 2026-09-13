import { buildNavixaVoiceBiasPhrases } from "./voiceDetection.ts";
import { createNavixaLocalNameFallback, type NavixaLocalSpeechLanguage } from "./localNameFallback.ts";
import { buildNavixaVoiceBiasInput, learnNavixaVoiceTranscript, type NavixaVoiceAliasSource } from "./voiceLearning.ts";

export type NavixaVoiceLanguage =
  | "ar-SA"
  | "ar-EG"
  | "ar-SY"
  | "ar-MA"
  | "ar-DZ"
  | "en-IN"
  | "en-US"
  | "en-GB"
  | "en-PH";

export type NavixaVoiceLanguageFamily = "ar" | "en";

export type NavixaVoiceTranscript = {
  text: string;
  interim: boolean;
  confidence?: number;
};

export type NavixaVoiceEngineHandlers = {
  onTranscript: (transcript: NavixaVoiceTranscript) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

export type NavixaVoiceEngine = {
  readonly provider: "browser";
  readonly supported: boolean;
  start: () => boolean;
  stop: () => void;
  destroy: () => void;
};

type SpeechRecognitionAlternativeLike = {
  transcript?: unknown;
  confidence?: unknown;
};

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  length?: number;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
};

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results?: {
    length: number;
    [index: number]: SpeechRecognitionResultLike | undefined;
  };
};

type SpeechRecognitionErrorEventLike = {
  error?: unknown;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  phrases?: unknown;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onnomatch: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type SpeechRecognitionPhraseConstructor = new (phrase: string, boost?: number) => unknown;

type BrowserVoiceEngineOptions = {
  language?: NavixaVoiceLanguage;
  continuous?: boolean;
  interimResults?: boolean;
  localAccuracyFallback?: boolean;
  adaptiveLanguage?: boolean;
  mediaStream?: MediaStream;
  contextualBiasTerms?: string;
  learningEnabled?: boolean;
  useStoredLanguageHint?: boolean;
  persistLanguageHint?: boolean;
  handlers: NavixaVoiceEngineHandlers;
};

const ARABIC_LANGUAGES: NavixaVoiceLanguage[] = ["ar-SA", "ar-EG", "ar-SY", "ar-MA", "ar-DZ"];
const ENGLISH_LANGUAGES: NavixaVoiceLanguage[] = ["en-IN", "en-US", "en-GB", "en-PH"];
const ADAPTIVE_LANGUAGES: NavixaVoiceLanguage[] = [
  "ar-SA",
  "en-IN",
  "ar-EG",
  "en-US",
  "ar-SY",
  "en-GB",
  "ar-MA",
  "en-PH",
  "ar-DZ",
];
const LANGUAGE_HINT_STORAGE_KEY = "navixa-voice-language-hint";
const INITIAL_LANGUAGE_PROBE_MS = 12_000;
const ACTIVE_LANGUAGE_PROBE_MS = 18_000;
const LOW_CONFIDENCE_PROBE_MS = 6_000;

export const navixaVoiceLanguageFamily = (language: NavixaVoiceLanguage): NavixaVoiceLanguageFamily => (
  language.startsWith("ar-") ? "ar" : "en"
);

const familyLanguages = (family: NavixaVoiceLanguageFamily) => (
  family === "ar" ? ARABIC_LANGUAGES : ENGLISH_LANGUAGES
);

const getRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition || null;
};

const applyContextualBias = (recognition: BrowserSpeechRecognition, overrideTerms?: string) => {
  if (typeof window === "undefined") return;
  try {
    const browserWindow = window as typeof window & {
      SpeechRecognitionPhrase?: SpeechRecognitionPhraseConstructor;
    };
    const Phrase = browserWindow.SpeechRecognitionPhrase;
    if (!Phrase) return;
    const watchTerms = overrideTerms !== undefined
      ? overrideTerms
      : window.localStorage?.getItem("navixa-watch-terms") || "";
    const biasInput = overrideTerms !== undefined ? watchTerms : buildNavixaVoiceBiasInput(watchTerms);
    const phrases = buildNavixaVoiceBiasPhrases(biasInput);
    if (!phrases.length) return;
    recognition.phrases = phrases.map((phrase) => new Phrase(phrase, 5.5));
  } catch {
    // Contextual biasing is experimental. Unsupported browsers keep the normal listener.
  }
};

const readAlternatives = (result: SpeechRecognitionResultLike | undefined, limit: number) => {
  const alternatives: Array<{ text: string; confidence?: number }> = [];
  if (!result) return alternatives;
  const resultLength = typeof result.length === "number" && result.length > 0 ? result.length : limit;
  const count = Math.min(Math.max(1, resultLength), limit);
  for (let index = 0; index < count; index += 1) {
    const alternative = result[index];
    if (!alternative) break;
    const text = typeof alternative.transcript === "string" ? alternative.transcript.trim() : "";
    if (!text) continue;
    const confidence = typeof alternative.confidence === "number" ? alternative.confidence : undefined;
    alternatives.push({ text, confidence });
  }
  return alternatives;
};

const readStoredLanguageHint = (): NavixaVoiceLanguage | null => {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage?.getItem(LANGUAGE_HINT_STORAGE_KEY);
    return ADAPTIVE_LANGUAGES.includes(value as NavixaVoiceLanguage) ? value as NavixaVoiceLanguage : null;
  } catch {
    return null;
  }
};

const rememberLanguageHint = (language: NavixaVoiceLanguage) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem?.(LANGUAGE_HINT_STORAGE_KEY, language);
  } catch {
    // Language hints are only a local optimization; recognition does not depend on storage.
  }
};

const detectTranscriptScript = (text: string): NavixaVoiceLanguageFamily | null => {
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (arabic >= 2 && arabic > latin * 1.25) return "ar";
  if (latin >= 3 && latin > arabic * 1.25) return "en";
  return null;
};

function createLocalOnlyVoiceEngine({
  mediaStream,
  learningEnabled,
  handlers,
}: Pick<BrowserVoiceEngineOptions, "mediaStream" | "learningEnabled" | "handlers">): NavixaVoiceEngine {
  let destroyed = false;
  let active = false;
  let starting = false;
  let startNotified = false;

  const notifyStarted = () => {
    if (destroyed || startNotified) return;
    startNotified = true;
    handlers.onStart?.();
  };

  const resetStartNotification = () => {
    startNotified = false;
  };

  const failStart = () => {
    if (destroyed) return;
    starting = false;
    active = false;
    resetStartNotification();
    handlers.onError?.("voice-recognition-error");
  };

  const localFallback = createNavixaLocalNameFallback({
    onTranscript: (text) => {
      if (learningEnabled) learnNavixaVoiceTranscript(text, "local");
      handlers.onTranscript({ text, interim: true });
    },
    getLanguageHint: () => "auto",
    mediaStream,
  });

  return {
    provider: "browser",
    supported: localFallback.supported,
    start: () => {
      if (!localFallback.supported || destroyed || active || starting) return false;
      starting = true;
      notifyStarted();
      void localFallback.start().then((started) => {
        starting = false;
        if (destroyed) return;
        if (!started) {
          failStart();
          return;
        }
        active = true;
      }).catch(failStart);
      return true;
    },
    stop: () => {
      if (destroyed) return;
      const wasRunning = active || starting || startNotified;
      active = false;
      starting = false;
      resetStartNotification();
      localFallback.stop();
      if (wasRunning) handlers.onEnd?.();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      active = false;
      starting = false;
      resetStartNotification();
      localFallback.destroy();
    },
  };
}

export function createNavixaBrowserVoiceEngine({
  language = "ar-SA",
  continuous = true,
  interimResults = true,
  localAccuracyFallback = true,
  adaptiveLanguage = true,
  mediaStream,
  contextualBiasTerms,
  learningEnabled = true,
  useStoredLanguageHint = true,
  persistLanguageHint = true,
  handlers,
}: BrowserVoiceEngineOptions): NavixaVoiceEngine {
  const Recognition = getRecognitionConstructor();
  if (!Recognition) {
    if (localAccuracyFallback) {
      return createLocalOnlyVoiceEngine({ mediaStream, learningEnabled, handlers });
    }
    return {
      provider: "browser",
      supported: false,
      start: () => false,
      stop: () => undefined,
      destroy: () => undefined,
    };
  }

  const recognition = new Recognition();
  const storedLanguageHint = useStoredLanguageHint ? readStoredLanguageHint() : null;
  const initialLanguage = adaptiveLanguage ? storedLanguageHint || language : language;
  let languageIndex = Math.max(0, ADAPTIVE_LANGUAGES.indexOf(initialLanguage));
  let lastDetectedFamily: NavixaVoiceLanguageFamily | null = null;
  const currentLanguage = () => adaptiveLanguage ? ADAPTIVE_LANGUAGES[languageIndex] : language;
  recognition.lang = currentLanguage();
  recognition.continuous = continuous;
  recognition.interimResults = interimResults;
  recognition.maxAlternatives = 5;
  applyContextualBias(recognition, contextualBiasTerms);

  const emitTranscript = (transcript: NavixaVoiceTranscript, source: NavixaVoiceAliasSource) => {
    if (learningEnabled && learnNavixaVoiceTranscript(transcript.text, source)) {
      applyContextualBias(recognition, contextualBiasTerms);
    }
    handlers.onTranscript(transcript);
  };

  const setLanguage = (next: NavixaVoiceLanguage) => {
    const index = ADAPTIVE_LANGUAGES.indexOf(next);
    if (index >= 0) languageIndex = index;
  };

  const advanceLanguage = () => {
    if (!adaptiveLanguage) return;
    if (!lastDetectedFamily) {
      languageIndex = (languageIndex + 1) % ADAPTIVE_LANGUAGES.length;
      return;
    }
    const candidates = familyLanguages(lastDetectedFamily);
    const activeLanguage = currentLanguage();
    const familyIndex = candidates.indexOf(activeLanguage);
    setLanguage(candidates[(familyIndex + 1 + candidates.length) % candidates.length]);
  };

  const localLanguageHint = (): NavixaLocalSpeechLanguage => lastDetectedFamily || "auto";
  const localFallback = localAccuracyFallback
    ? createNavixaLocalNameFallback({
      onTranscript: (text) => emitTranscript({ text, interim: true }, "local"),
      getLanguageHint: localLanguageHint,
      mediaStream,
    })
    : null;

  let destroyed = false;
  let browserActive = false;
  let browserStarting = false;
  let keepListening = false;
  let startNotified = false;
  let languageProbeTimer: ReturnType<typeof setTimeout> | null = null;
  let browserRestartTimer: ReturnType<typeof setTimeout> | null = null;

  const notifyStarted = () => {
    if (destroyed || startNotified) return;
    startNotified = true;
    handlers.onStart?.();
  };

  const resetStartNotification = () => {
    startNotified = false;
  };

  const clearLanguageProbe = () => {
    if (languageProbeTimer) clearTimeout(languageProbeTimer);
    languageProbeTimer = null;
  };

  const clearBrowserRestart = () => {
    if (browserRestartTimer) clearTimeout(browserRestartTimer);
    browserRestartTimer = null;
  };

  const startBrowserSession = () => {
    if (destroyed || !keepListening || browserActive || browserStarting) return false;
    try {
      recognition.lang = currentLanguage();
      browserStarting = true;
      recognition.start();
      return true;
    } catch {
      browserStarting = false;
      return false;
    }
  };

  const scheduleBrowserRestart = (delay = 250) => {
    if (destroyed || !keepListening) return;
    clearBrowserRestart();
    browserRestartTimer = setTimeout(() => {
      browserRestartTimer = null;
      if (destroyed || !keepListening || browserActive || browserStarting) return;
      if (startBrowserSession()) return;
      if (localFallback?.supported) return;
      keepListening = false;
      resetStartNotification();
      handlers.onError?.("voice-recognition-error");
    }, delay);
  };

  const requestLanguageRestart = (next?: NavixaVoiceLanguage) => {
    if (!adaptiveLanguage || destroyed || !browserActive) return;
    if (next) setLanguage(next);
    else advanceLanguage();
    clearLanguageProbe();
    try {
      recognition.stop();
    } catch {
      scheduleBrowserRestart();
    }
  };

  const armLanguageProbe = (delay = INITIAL_LANGUAGE_PROBE_MS) => {
    if (!adaptiveLanguage || destroyed || !browserActive) return;
    clearLanguageProbe();
    languageProbeTimer = setTimeout(() => requestLanguageRestart(), delay);
  };

  recognition.onstart = () => {
    if (destroyed) return;
    browserStarting = false;
    browserActive = true;
    armLanguageProbe();
    notifyStarted();
  };

  recognition.onresult = (event) => {
    if (destroyed || !event.results) return;
    const resultIndex = Number.isInteger(event.resultIndex) ? Math.max(0, event.resultIndex ?? 0) : 0;
    const interimByRank = new Map<number, Array<{ text: string; confidence?: number }>>();
    let finalPrimaryText = "";
    let finalPrimaryConfidence: number | undefined;

    for (let index = resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const alternatives = readAlternatives(result, recognition.maxAlternatives);
      if (!alternatives.length) continue;

      if (result?.isFinal) {
        for (let alternativeIndex = 1; alternativeIndex < alternatives.length; alternativeIndex += 1) {
          emitTranscript({ ...alternatives[alternativeIndex], interim: true }, "browser");
        }
        finalPrimaryText = alternatives[0].text;
        finalPrimaryConfidence = alternatives[0].confidence;
        emitTranscript({ ...alternatives[0], interim: false }, "browser");
        continue;
      }

      alternatives.forEach((alternative, alternativeIndex) => {
        const parts = interimByRank.get(alternativeIndex) || [];
        parts.push(alternative);
        interimByRank.set(alternativeIndex, parts);
      });
    }

    const ranks = [...interimByRank.keys()].sort((left, right) => right - left);
    for (const rank of ranks) {
      const parts = interimByRank.get(rank) || [];
      if (!parts.length) continue;
      emitTranscript({
        text: parts.map((part) => part.text).join(" "),
        interim: true,
        confidence: parts.at(-1)?.confidence,
      }, "browser");
    }

    if (!adaptiveLanguage || !finalPrimaryText) return;
    const script = detectTranscriptScript(finalPrimaryText);
    if (script) lastDetectedFamily = script;

    const activeLanguage = currentLanguage();
    if (script === "ar" && navixaVoiceLanguageFamily(activeLanguage) !== "ar") {
      requestLanguageRestart("ar-SA");
      return;
    }
    if (script === "en" && navixaVoiceLanguageFamily(activeLanguage) !== "en") {
      requestLanguageRestart("en-IN");
      return;
    }

    if (typeof finalPrimaryConfidence === "number" && finalPrimaryConfidence > 0 && finalPrimaryConfidence < 0.35) {
      requestLanguageRestart();
      return;
    }
    if (typeof finalPrimaryConfidence === "number" && finalPrimaryConfidence > 0 && finalPrimaryConfidence < 0.5) {
      armLanguageProbe(LOW_CONFIDENCE_PROBE_MS);
      return;
    }
    if (persistLanguageHint) rememberLanguageHint(activeLanguage);
    armLanguageProbe(ACTIVE_LANGUAGE_PROBE_MS);
  };

  recognition.onerror = (event) => {
    if (destroyed) return;
    browserStarting = false;
    const error = typeof event?.error === "string" ? event.error : "voice-recognition-error";
    if (adaptiveLanguage && error === "no-speech") advanceLanguage();
    if (error === "not-allowed" || error === "audio-capture") {
      keepListening = false;
      clearBrowserRestart();
      resetStartNotification();
      handlers.onError?.(error);
      return;
    }
    if (localFallback?.supported || error === "no-speech") return;
    keepListening = false;
    clearBrowserRestart();
    resetStartNotification();
    handlers.onError?.(error);
  };

  recognition.onnomatch = () => {
    if (destroyed || !adaptiveLanguage) return;
    requestLanguageRestart();
  };

  recognition.onend = () => {
    browserActive = false;
    browserStarting = false;
    clearLanguageProbe();
    if (destroyed || !keepListening) return;
    if (!startBrowserSession()) scheduleBrowserRestart();
  };

  return {
    provider: "browser",
    supported: true,
    start: () => {
      if (destroyed || keepListening || browserActive || browserStarting) return false;
      keepListening = true;
      const browserStarted = startBrowserSession();
      if (browserStarted) notifyStarted();

      if (localFallback?.supported) {
        if (!browserStarted) notifyStarted();
        void localFallback.start().then((localStarted) => {
          if (destroyed || browserStarted) return;
          if (localStarted) {
            scheduleBrowserRestart(1_000);
            return;
          }
          keepListening = false;
          resetStartNotification();
          handlers.onError?.("voice-recognition-error");
        }).catch(() => {
          if (destroyed || browserStarted) return;
          keepListening = false;
          resetStartNotification();
          handlers.onError?.("voice-recognition-error");
        });
        return true;
      }

      if (!browserStarted) keepListening = false;
      return browserStarted;
    },
    stop: () => {
      if (destroyed) return;
      const wasRunning = keepListening || browserActive || browserStarting || startNotified;
      keepListening = false;
      browserActive = false;
      browserStarting = false;
      clearBrowserRestart();
      clearLanguageProbe();
      resetStartNotification();
      localFallback?.stop();
      try {
        recognition.stop();
      } catch {
        // Browser recognition can already be stopped between events.
      }
      if (wasRunning) handlers.onEnd?.();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      keepListening = false;
      browserActive = false;
      browserStarting = false;
      resetStartNotification();
      clearBrowserRestart();
      clearLanguageProbe();
      localFallback?.destroy();
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onnomatch = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Nothing else owns this recognition instance.
      }
    },
  };
}
