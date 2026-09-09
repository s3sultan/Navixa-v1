export type NavixaVoiceLanguage = "ar-SA" | "en-US";

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
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type BrowserVoiceEngineOptions = {
  language?: NavixaVoiceLanguage;
  continuous?: boolean;
  interimResults?: boolean;
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

export function createNavixaBrowserVoiceEngine({
  language = "ar-SA",
  continuous = true,
  interimResults = true,
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
  recognition.maxAlternatives = 1;

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
    const interimParts: string[] = [];
    let interimConfidence: number | undefined;

    for (let index = resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const alternative = result?.[0];
      const text = typeof alternative?.transcript === "string" ? alternative.transcript.trim() : "";
      if (!text) continue;
      const confidence = typeof alternative?.confidence === "number" ? alternative.confidence : undefined;

      if (result?.isFinal) {
        handlers.onTranscript({ text, interim: false, confidence });
        continue;
      }

      interimParts.push(text);
      if (confidence !== undefined) interimConfidence = confidence;
    }

    if (interimParts.length) {
      handlers.onTranscript({
        text: interimParts.join(" "),
        interim: true,
        confidence: interimConfidence,
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
        return true;
      } catch {
        return false;
      }
    },
    stop: () => {
      if (destroyed) return;
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
