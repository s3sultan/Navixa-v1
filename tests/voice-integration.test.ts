import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/navixa.css", import.meta.url), "utf8");
const engine = fs.readFileSync(new URL("../app/voice/voiceEngine.ts", import.meta.url), "utf8");
test("home listener uses the NAVIXA voice engine instead of direct SpeechRecognition", () => {
  assert.match(page, /createNavixaBrowserVoiceEngine/);
  assert.match(page, /voiceEngineRef=useRef<NavixaVoiceEngine\|null>/);
  assert.doesNotMatch(page, /const recognitionRef=useRef<any>/);
  assert.doesNotMatch(page, /new SpeechRecognition\(/);
});
test("listener keeps local detection and lifecycle cleanup", () => {
  assert.match(page, /findNavixaVoiceTerm\(text,terms\)/);
  assert.match(page, /captureSpokenIntent\(text\)/);
  assert.match(page, /voiceEngineRef\.current\?\.destroy\(\)/);
  assert.match(page, /error==="no-speech"/);
});
test("listener keeps the local fallback reachable when browser speech recognition is missing or refuses to start", () => {
  assert.match(engine, /if \(!Recognition\)[\s\S]*createLocalOnlyVoiceEngine/);
  assert.match(engine, /if \(localFallback\?\.supported\)[\s\S]*localFallback\.start\(\)/);
  assert.match(engine, /return browserStarted/);
});
test("listener micro interactions respect reduced motion", () => {
  assert.match(css, /NAVIXA Micro Interactions: listener/);
  assert.match(css, /navixa-listener-pulse/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
