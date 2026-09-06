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

type SpeechRecognitionConstructor = new () => any;

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

  recognition.onresult = (event: any) => {
    if (destroyed) return;
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const alternative = result?.[0];
      const text = typeof alternative?.transcript === "string" ? alternative.transcript.trim() : "";
      if (!text) continue;
      handlers.onTranscript({
        text,
        interim: !result.isFinal,
        confidence: typeof alternative.confidence === "number" ? alternative.confidence : undefined,
      });
    }
  };

  recognition.onerror = (event: any) => {
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
