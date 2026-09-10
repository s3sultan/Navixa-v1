import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNavixaVoiceBiasPhrases,
  findNavixaVoiceTerm,
  navixaVoicePhoneticSkeleton,
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

test("builds contextual bias phrases without losing a full name", () => {
  assert.deepEqual(buildNavixaVoiceBiasPhrases("سلطان الحربي، quiz"), [
    "سلطان الحربي",
    "سلطان",
    "الحربي",
    "quiz",
  ]);
});

test("matches complete Arabic and English tokens", () => {
  assert.equal(findNavixaVoiceTerm("يا سلطان عندك واجب اليوم", ["سلطان"])?.normalizedTerm, "سلطان");
  assert.equal(findNavixaVoiceTerm("Please ask Sultan now", ["sultan"])?.normalizedTerm, "sultan");
});

test("matches multi-word watched phrases across normalized spacing", () => {
  assert.equal(findNavixaVoiceTerm("يا   سلطان الحربي انتبه", ["سلطان الحربي"])?.normalizedTerm, "سلطان الحربي");
});

test("matches safe Latin accent and segmentation variants", () => {
  assert.equal(findNavixaVoiceTerm("Please ask Sultaan now", ["sultan"])?.normalizedTerm, "sultan");
  assert.equal(findNavixaVoiceTerm("Please ask soul tan now", ["sultan"])?.normalizedTerm, "sultan");
  assert.equal(findNavixaVoiceTerm("Doctor called Soltan", ["sultan"])?.normalizedTerm, "sultan");
});

test("matches common Arabic and Latin renderings by a conservative phonetic skeleton", () => {
  assert.equal(navixaVoicePhoneticSkeleton("سلطان"), navixaVoicePhoneticSkeleton("Sultan"));
  assert.equal(navixaVoicePhoneticSkeleton("محمد"), navixaVoicePhoneticSkeleton("Mohammed"));
  assert.equal(navixaVoicePhoneticSkeleton("الحربي"), navixaVoicePhoneticSkeleton("Alharbi"));
  assert.equal(findNavixaVoiceTerm("Please ask Mohammed now", ["محمد"])?.normalizedTerm, "محمد");
  assert.equal(findNavixaVoiceTerm("Next is Alharbi", ["الحربي"])?.normalizedTerm, "الحربي");
});

test("does not turn loose phonetic similarity into a name alert", () => {
  assert.equal(findNavixaVoiceTerm("Please ask Salman now", ["sultan"]), null);
  assert.equal(findNavixaVoiceTerm("Please ask Salim now", ["sultan"]), null);
  assert.equal(findNavixaVoiceTerm("علي موجود", ["عمر"]), null);
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
