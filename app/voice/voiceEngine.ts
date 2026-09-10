import { buildNavixaVoiceBiasPhrases } from "./voiceDetection.ts";
import { createNavixaLocalNameFallback } from "./localNameFallback.ts";

export type NavixaVoiceLanguage = "ar-SA" | "en-US" | "en-IN";

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
  handlers: NavixaVoiceEngineHandlers;
};

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
    const phrases = buildNavixaVoiceBiasPhrases(storedTerms);
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

export function createNavixaBrowserVoiceEngine({
  language = "ar-SA",
  continuous = true,
  interimResults = true,
  localAccuracyFallback = true,
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
  recognition.lang = language;
  recognition.continuous = continuous;
  recognition.interimResults = interimResults;
  recognition.maxAlternatives = 5;
  applyStoredContextualBias(recognition);

  const localFallback = localAccuracyFallback
    ? createNavixaLocalNameFallback({
      onTranscript: (text) => handlers.onTranscript({ text, interim: true }),
    })
    : null;

  let destroyed = false;
  let active = false;

  recognition.onstart = () => {
    if (destroyed) return;
    active = true;
    handlers.onStart?.();
  };

  recognition.onresult = (event) => {
    if (destroyed || !event.results) return;
    const resultIndex = Number.isInteger(event.resultIndex) ? Math.max(0, event.resultIndex ?? 0) : 0;
    const interimByRank = new Map<number, Array<{ text: string; confidence?: number }>>();

    for (let index = resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const alternatives = readAlternatives(result, recognition.maxAlternatives);
      if (!alternatives.length) continue;

      if (result?.isFinal) {
        for (let alternativeIndex = 1; alternativeIndex < alternatives.length; alternativeIndex += 1) {
          handlers.onTranscript({ ...alternatives[alternativeIndex], interim: true });
        }
        handlers.onTranscript({ ...alternatives[0], interim: false });
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
      handlers.onTranscript({
        text: parts.map((part) => part.text).join(" "),
        interim: true,
        confidence: parts.at(-1)?.confidence,
      });
    }
  };

  recognition.onerror = (event) => {
    if (destroyed) return;
    const error = typeof event?.error === "string" ? event.error : "voice-recognition-error";
    handlers.onError?.(error);
  };

  recognition.onend = () => {
    active = false;
    if (!destroyed) handlers.onEnd?.();
  };

  return {
    provider: "browser",
    supported: true,
    start: () => {
      if (destroyed || active) return false;
      try {
        recognition.start();
        if (localFallback?.supported) void localFallback.start();
        return true;
      } catch {
        return false;
      }
    },
    stop: () => {
      if (destroyed) return;
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
      localFallback?.destroy();
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Nothing else owns this recognition instance.
      }
    },
  };
}
