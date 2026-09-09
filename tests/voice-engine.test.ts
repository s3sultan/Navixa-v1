import assert from "node:assert/strict";
import test from "node:test";
import { createNavixaBrowserVoiceEngine } from "../app/voice/voiceEngine.ts";

type FakeAlternative = { transcript: string; confidence: number };
type FakeResult = { 0: FakeAlternative; isFinal: boolean };
type FakeResultEvent = { resultIndex: number; results: FakeResult[] };
type FakeErrorEvent = { error?: string };

class FakeRecognition {
  static latest: FakeRecognition | null = null;

  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: FakeResultEvent) => void) | null = null;
  onerror: ((event: FakeErrorEvent) => void) | null = null;
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

const setFakeWindow = () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { SpeechRecognition: FakeRecognition },
  });
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
    assert.equal(engine.start(), true);
    assert.equal(starts, 1);
    assert.equal(engine.start(), false);
    engine.destroy();
    assert.equal(recognition.abortCalls, 1);
    assert.equal(recognition.onresult, null);
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
