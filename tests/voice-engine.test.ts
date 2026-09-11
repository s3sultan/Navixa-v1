import assert from "node:assert/strict";
import test from "node:test";
import { findNavixaVoiceTerm } from "../app/voice/voiceDetection.ts";
import { createNavixaBrowserVoiceEngine, navixaVoiceLanguageFamily } from "../app/voice/voiceEngine.ts";
import { readNavixaLearnedVoiceAliases, rememberNavixaVoiceMatch } from "../app/voice/voiceLearning.ts";

type FakeAlternative = { transcript: string; confidence: number };
type FakeResult = { 0: FakeAlternative; 1?: FakeAlternative; 2?: FakeAlternative; length?: number; isFinal: boolean };
type FakeResultEvent = { resultIndex: number; results: FakeResult[] };
type FakeErrorEvent = { error?: string };

class FakeRecognition {
  static latest: FakeRecognition | null = null;

  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  phrases: unknown = undefined;
  onstart: (() => void) | null = null;
  onresult: ((event: FakeResultEvent) => void) | null = null;
  onerror: ((event: FakeErrorEvent) => void) | null = null;
  onnomatch: (() => void) | null = null;
  onend: (() => void) | null = null;
  startCalls = 0;
  stopCalls = 0;
  abortCalls = 0;

  constructor() {
    FakeRecognition.latest = this;
  }

  start() {
    this.startCalls += 1;
    this.onstart?.();
  }

  stop() {
    this.stopCalls += 1;
  }

  abort() {
    this.abortCalls += 1;
  }
}

class FakePhrase {
  phrase: string;
  boost: number;

  constructor(phrase: string, boost = 1) {
    this.phrase = phrase;
    this.boost = boost;
  }
}

const setFakeWindow = (storedTerms = "") => {
  const store = new Map<string, string>();
  if (storedTerms) store.set("navixa-watch-terms", storedTerms);
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      SpeechRecognition: FakeRecognition,
      SpeechRecognitionPhrase: FakePhrase,
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
      },
    },
  });
  return store;
};

const clearFakeWindow = () => {
  Reflect.deleteProperty(globalThis, "window");
  FakeRecognition.latest = null;
};

test("configures and cleans up the browser voice engine", () => {
  setFakeWindow();
  try {
    let starts = 0;
    const engine = createNavixaBrowserVoiceEngine({
      language: "ar-SA",
      handlers: {
        onTranscript: () => undefined,
        onStart: () => { starts += 1; },
      },
    });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition);
    assert.equal(engine.supported, true);
    assert.equal(recognition.lang, "ar-SA");
    assert.equal(recognition.continuous, true);
    assert.equal(recognition.interimResults, true);
    assert.equal(recognition.maxAlternatives, 5);
    assert.equal(engine.start(), true);
    assert.equal(starts, 1);
    assert.equal(engine.start(), false);
    engine.destroy();
    assert.equal(recognition.abortCalls, 1);
    assert.equal(recognition.onresult, null);
    assert.equal(recognition.onnomatch, null);
  } finally {
    clearFakeWindow();
  }
});

test("adds stored watched names as conservative contextual recognition hints", () => {
  setFakeWindow("سلطان الحربي، quiz");
  try {
    createNavixaBrowserVoiceEngine({ handlers: { onTranscript: () => undefined } });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition);
    const phrases = recognition.phrases as FakePhrase[];
    assert.deepEqual(phrases.map(({ phrase }) => phrase), ["سلطان الحربي", "سلطان", "الحربي", "quiz"]);
    assert.ok(phrases.every(({ boost }) => boost === 5.5));
  } finally {
    clearFakeWindow();
  }
});

test("learns an accented pronunciation only after repeat evidence or source agreement", () => {
  setFakeWindow("sultan");
  try {
    const match = findNavixaVoiceTerm("Doctor called Soltan", ["sultan"]);
    assert.ok(match);
    const now = Date.now();
    assert.equal(rememberNavixaVoiceMatch(match, "browser", now), false);
    assert.deepEqual(readNavixaLearnedVoiceAliases("sultan", now), []);
    assert.equal(rememberNavixaVoiceMatch(match, "local", now + 1), true);
    assert.deepEqual(readNavixaLearnedVoiceAliases("sultan", now + 1), ["soltan"]);
  } finally {
    clearFakeWindow();
  }
});

test("reuses a trusted learned pronunciation as contextual bias", () => {
  setFakeWindow("sultan");
  try {
    const match = findNavixaVoiceTerm("Doctor called Soltan", ["sultan"]);
    assert.ok(match);
    const now = Date.now();
    rememberNavixaVoiceMatch(match, "browser", now);
    rememberNavixaVoiceMatch(match, "local", now + 1);
    createNavixaBrowserVoiceEngine({ handlers: { onTranscript: () => undefined } });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition);
    const phrases = recognition.phrases as FakePhrase[];
    assert.deepEqual(phrases.map(({ phrase }) => phrase), ["sultan", "soltan"]);
  } finally {
    clearFakeWindow();
  }
});

test("emits final transcripts and aggregates interim parts like the original listener", () => {
  setFakeWindow();
  try {
    const transcripts: Array<{ text: string; interim: boolean }> = [];
    createNavixaBrowserVoiceEngine({
      handlers: {
        onTranscript: ({ text, interim }) => transcripts.push({ text, interim }),
      },
    });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition?.onresult);
    recognition.onresult({
      resultIndex: 0,
      results: [
        { 0: { transcript: "تم تحديد الموعد", confidence: 0.95 }, isFinal: true },
        { 0: { transcript: "يا سلطان", confidence: 0.8 }, isFinal: false },
        { 0: { transcript: "عندك واجب", confidence: 0.82 }, isFinal: false },
      ],
    });
    assert.deepEqual(transcripts, [
      { text: "تم تحديد الموعد", interim: false },
      { text: "يا سلطان عندك واجب", interim: true },
    ]);
  } finally {
    clearFakeWindow();
  }
});

test("surfaces lower-ranked recognition alternatives for name matching without treating them as final intent", () => {
  setFakeWindow();
  try {
    const transcripts: Array<{ text: string; interim: boolean }> = [];
    createNavixaBrowserVoiceEngine({
      handlers: {
        onTranscript: ({ text, interim }) => transcripts.push({ text, interim }),
      },
    });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition?.onresult);
    recognition.onresult({
      resultIndex: 0,
      results: [{
        0: { transcript: "please ask someone", confidence: 0.7 },
        1: { transcript: "please ask sultaan", confidence: 0.64 },
        length: 2,
        isFinal: true,
      }],
    });
    assert.deepEqual(transcripts, [
      { text: "please ask sultaan", interim: true },
      { text: "please ask someone", interim: false },
    ]);
  } finally {
    clearFakeWindow();
  }
});

test("switches the same browser recognizer from Arabic to Indian English when speech becomes English", () => {
  setFakeWindow();
  try {
    const engine = createNavixaBrowserVoiceEngine({
      language: "ar-SA",
      localAccuracyFallback: false,
      handlers: { onTranscript: () => undefined },
    });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition?.onresult && recognition.onend);
    assert.equal(engine.start(), true);
    assert.equal(recognition.lang, "ar-SA");
    recognition.onresult({
      resultIndex: 0,
      results: [{ 0: { transcript: "please call sultan now", confidence: 0.9 }, isFinal: true }],
    });
    assert.equal(recognition.stopCalls, 1);
    recognition.onend();
    assert.equal(engine.start(), true);
    assert.equal(recognition.lang, "en-IN");
    assert.equal(FakeRecognition.latest, recognition);
    engine.destroy();
  } finally {
    clearFakeWindow();
  }
});

test("returns the same recognizer to Arabic when Arabic speech follows English", () => {
  setFakeWindow();
  try {
    const engine = createNavixaBrowserVoiceEngine({
      language: "en-IN",
      localAccuracyFallback: false,
      handlers: { onTranscript: () => undefined },
    });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition?.onresult && recognition.onend);
    assert.equal(engine.start(), true);
    assert.equal(recognition.lang, "en-IN");
    recognition.onresult({
      resultIndex: 0,
      results: [{ 0: { transcript: "يا سلطان انت موجود", confidence: 0.9 }, isFinal: true }],
    });
    assert.equal(recognition.stopCalls, 1);
    recognition.onend();
    assert.equal(engine.start(), true);
    assert.equal(recognition.lang, "ar-SA");
    assert.equal(FakeRecognition.latest, recognition);
    engine.destroy();
  } finally {
    clearFakeWindow();
  }
});

test("cycles toward Indian English after a no-speech recognition cycle", () => {
  setFakeWindow();
  try {
    const engine = createNavixaBrowserVoiceEngine({
      language: "ar-SA",
      localAccuracyFallback: false,
      handlers: { onTranscript: () => undefined },
    });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition?.onerror && recognition.onend);
    assert.equal(engine.start(), true);
    recognition.onerror({ error: "no-speech" });
    recognition.onend();
    assert.equal(engine.start(), true);
    assert.equal(recognition.lang, "en-IN");
    engine.destroy();
  } finally {
    clearFakeWindow();
  }
});

test("rotates language after an explicit browser no-match", () => {
  setFakeWindow();
  try {
    const engine = createNavixaBrowserVoiceEngine({
      language: "ar-SA",
      localAccuracyFallback: false,
      handlers: { onTranscript: () => undefined },
    });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition?.onnomatch && recognition.onend);
    assert.equal(engine.start(), true);
    recognition.onnomatch();
    assert.equal(recognition.stopCalls, 1);
    recognition.onend();
    assert.equal(engine.start(), true);
    assert.equal(recognition.lang, "en-IN");
    engine.destroy();
  } finally {
    clearFakeWindow();
  }
});

test("rotates language early after a very low-confidence final result", () => {
  setFakeWindow();
  try {
    const engine = createNavixaBrowserVoiceEngine({
      language: "ar-SA",
      localAccuracyFallback: false,
      handlers: { onTranscript: () => undefined },
    });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition?.onresult && recognition.onend);
    assert.equal(engine.start(), true);
    recognition.onresult({
      resultIndex: 0,
      results: [{ 0: { transcript: "unclear speech", confidence: 0.2 }, isFinal: true }],
    });
    assert.equal(recognition.stopCalls, 1);
    recognition.onend();
    assert.equal(engine.start(), true);
    assert.equal(recognition.lang, "en-IN");
    engine.destroy();
  } finally {
    clearFakeWindow();
  }
});

test("rotates within English accents after English has been identified", () => {
  setFakeWindow();
  try {
    const engine = createNavixaBrowserVoiceEngine({
      language: "ar-SA",
      localAccuracyFallback: false,
      handlers: { onTranscript: () => undefined },
    });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition?.onresult && recognition.onend && recognition.onnomatch);
    assert.equal(engine.start(), true);
    recognition.onresult({
      resultIndex: 0,
      results: [{ 0: { transcript: "please call sultan now", confidence: 0.9 }, isFinal: true }],
    });
    recognition.onend();
    assert.equal(engine.start(), true);
    assert.equal(recognition.lang, "en-IN");
    recognition.onnomatch();
    recognition.onend();
    assert.equal(engine.start(), true);
    assert.equal(recognition.lang, "en-US");
    engine.destroy();
  } finally {
    clearFakeWindow();
  }
});

test("rotates within Arabic dialect profiles after Arabic has been identified", () => {
  setFakeWindow();
  try {
    const engine = createNavixaBrowserVoiceEngine({
      language: "ar-SA",
      localAccuracyFallback: false,
      handlers: { onTranscript: () => undefined },
    });
    const recognition = FakeRecognition.latest;
    assert.ok(recognition?.onresult && recognition.onend && recognition.onnomatch);
    assert.equal(engine.start(), true);
    recognition.onresult({
      resultIndex: 0,
      results: [{ 0: { transcript: "يا سلطان جاوب", confidence: 0.92 }, isFinal: true }],
    });
    recognition.onnomatch();
    recognition.onend();
    assert.equal(engine.start(), true);
    assert.equal(recognition.lang, "ar-EG");
    engine.destroy();
  } finally {
    clearFakeWindow();
  }
});

test("accepts stored British and Filipino English profile hints", () => {
  for (const language of ["en-GB", "en-PH"] as const) {
    const store = setFakeWindow();
    try {
      store.set("navixa-voice-language-hint", language);
      const engine = createNavixaBrowserVoiceEngine({
        localAccuracyFallback: false,
        handlers: { onTranscript: () => undefined },
      });
      const recognition = FakeRecognition.latest;
      assert.ok(recognition);
      assert.equal(recognition.lang, language);
      engine.destroy();
    } finally {
      clearFakeWindow();
    }
  }
});

test("maps Gulf, Egyptian, Syrian, Maghrebi and English profiles to the right family", () => {
  for (const language of ["ar-SA", "ar-EG", "ar-SY", "ar-MA", "ar-DZ"] as const) {
    assert.equal(navixaVoiceLanguageFamily(language), "ar");
  }
  for (const language of ["en-IN", "en-US", "en-GB", "en-PH"] as const) {
    assert.equal(navixaVoiceLanguageFamily(language), "en");
  }
});
