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

const applyStoredContextualBias = (recognition: BrowserSpeechRecognition) => {
  if (typeof window === "undefined") return;
  try {
    const browserWindow = window as typeof window & {
      SpeechRecognitionPhrase?: SpeechRecognitionPhraseConstructor;
    };
    const Phrase = browserWindow.SpeechRecognitionPhrase;
    if (!Phrase) return;
    const storedTerms = window.localStorage?.getItem("navixa-watch-terms") || "";
    const biasInput = buildNavixaVoiceBiasInput(storedTerms);
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

export function createNavixaBrowserVoiceEngine({
  language = "ar-SA",
  continuous = true,
  interimResults = true,
  localAccuracyFallback = true,
  adaptiveLanguage = true,
  mediaStream,
  handlers,
}: BrowserVoiceEngineOptions): NavixaVoiceEngine {
  const Recognition = getRecognitionConstructor();
  if (!Recognition) {
    return {
      provider: "browser",
      supported: false,
      start: () => false,
      stop: () => undefined,
      destroy: () => undefined,
    };
  }

  const recognition = new Recognition();
  const initialLanguage = adaptiveLanguage ? readStoredLanguageHint() || language : language;
  let languageIndex = Math.max(0, ADAPTIVE_LANGUAGES.indexOf(initialLanguage));
  let lastDetectedFamily: NavixaVoiceLanguageFamily | null = null;
  const currentLanguage = () => adaptiveLanguage ? ADAPTIVE_LANGUAGES[languageIndex] : language;
  recognition.lang = currentLanguage();
  recognition.continuous = continuous;
  recognition.interimResults = interimResults;
  recognition.maxAlternatives = 5;
  applyStoredContextualBias(recognition);

  const emitTranscript = (transcript: NavixaVoiceTranscript, source: NavixaVoiceAliasSource) => {
    if (learnNavixaVoiceTranscript(transcript.text, source)) applyStoredContextualBias(recognition);
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
    const active = currentLanguage();
    const familyIndex = candidates.indexOf(active);
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
  let active = false;
  let languageProbeTimer: ReturnType<typeof setTimeout> | null = null;

  const clearLanguageProbe = () => {
    if (languageProbeTimer) clearTimeout(languageProbeTimer);
    languageProbeTimer = null;
  };

  const requestLanguageRestart = (next?: NavixaVoiceLanguage) => {
    if (!adaptiveLanguage || destroyed || !active) return;
    if (next) setLanguage(next);
    else advanceLanguage();
    clearLanguageProbe();
    try {
      recognition.stop();
    } catch {
      // The browser may already be between recognition sessions.
    }
  };

  const armLanguageProbe = (delay = INITIAL_LANGUAGE_PROBE_MS) => {
    if (!adaptiveLanguage || destroyed || !active) return;
    clearLanguageProbe();
    languageProbeTimer = setTimeout(() => requestLanguageRestart(), delay);
  };

  recognition.onstart = () => {
    if (destroyed) return;
    active = true;
    armLanguageProbe();
    handlers.onStart?.();
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
    rememberLanguageHint(activeLanguage);
    armLanguageProbe(ACTIVE_LANGUAGE_PROBE_MS);
  };

  recognition.onerror = (event) => {
    if (destroyed) return;
    const error = typeof event?.error === "string" ? event.error : "voice-recognition-error";
    if (adaptiveLanguage && error === "no-speech") advanceLanguage();
    handlers.onError?.(error);
  };

  recognition.onnomatch = () => {
    if (destroyed || !adaptiveLanguage) return;
    requestLanguageRestart();
  };

  recognition.onend = () => {
    active = false;
    clearLanguageProbe();
    if (!destroyed) handlers.onEnd?.();
  };

  return {
    provider: "browser",
    supported: true,
    start: () => {
      if (destroyed || active) return false;
      try {
        recognition.lang = currentLanguage();
        recognition.start();
        if (localFallback?.supported) void localFallback.start();
        return true;
      } catch {
        return false;
      }
    },
    stop: () => {
      if (destroyed) return;
      clearLanguageProbe();
      localFallback?.stop();
      try {
        recognition.stop();
      } catch {
        // Browser recognition can already be stopped between events.
      }
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      active = false;
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
