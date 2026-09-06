import assert from "node:assert/strict";
import test from "node:test";
import {
  findNavixaVoiceTerm,
  normalizeNavixaVoiceText,
  splitNavixaVoiceTerms,
} from "../app/voice/voiceDetection.ts";

test("normalizes Arabic diacritics, tatweel, punctuation, and letter variants", () => {
  assert.equal(normalizeNavixaVoiceText("  سُــلْطَان، الحَرْبِي! "), "سلطان الحربي");
  assert.equal(normalizeNavixaVoiceText("إبراهيم مؤيد"), "ابراهيم مويد");
});

test("splits and de-duplicates multiple watched terms", () => {
  assert.deepEqual(splitNavixaVoiceTerms("سلطان، واجب; كويز\nسلطان"), ["سلطان", "واجب", "كويز"]);
});

test("matches complete Arabic and English tokens", () => {
  assert.equal(findNavixaVoiceTerm("يا سلطان عندك واجب اليوم", ["سلطان"])?.normalizedTerm, "سلطان");
  assert.equal(findNavixaVoiceTerm("Please ask Sultan now", ["sultan"])?.normalizedTerm, "sultan");
});

test("matches multi-word watched phrases across normalized spacing", () => {
  assert.equal(findNavixaVoiceTerm("يا   سلطان الحربي انتبه", ["سلطان الحربي"])?.normalizedTerm, "سلطان الحربي");
});

test("does not trigger on substring-only false positives", () => {
  assert.equal(findNavixaVoiceTerm("هذا اختبار تجريبي", ["بار"]), null);
  assert.equal(findNavixaVoiceTerm("المطلوب واضح", ["طلب"]), null);
});

test("supports academic watch keywords without special casing", () => {
  for (const keyword of ["واجب", "كويز", "مطلوب", "اختبار"]) {
    assert.equal(findNavixaVoiceTerm(`عندك ${keyword} غدا`, [keyword])?.normalizedTerm, keyword);
  }
});
