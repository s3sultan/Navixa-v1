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
  assert.equal(normalizeNavixaVoiceText("گ چ پ ڤ"), "ك ج ب ف");
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

test("returns candidate, method and score for accent variants", () => {
  const fuzzy = findNavixaVoiceTerm("Doctor called Soltan", ["sultan"]);
  assert.ok(fuzzy);
  assert.equal(fuzzy.candidate, "soltan");
  assert.equal(fuzzy.method, "fuzzy");
  assert.ok(fuzzy.score >= 0.82);

  const phonetic = findNavixaVoiceTerm("Please ask Mohammed now", ["محمد"]);
  assert.ok(phonetic);
  assert.equal(phonetic.candidate, "mohammed");
  assert.equal(phonetic.method, "phonetic");
  assert.equal(phonetic.score, 0.9);
});

test("matches safe Latin accent and segmentation variants", () => {
  assert.equal(findNavixaVoiceTerm("Please ask Sultaan now", ["sultan"])?.normalizedTerm, "sultan");
  assert.equal(findNavixaVoiceTerm("Please ask soul tan now", ["sultan"])?.normalizedTerm, "sultan");
  assert.equal(findNavixaVoiceTerm("Doctor called Soltan", ["sultan"])?.normalizedTerm, "sultan");
  assert.equal(findNavixaVoiceTerm("Please ask Sulthan now", ["sultan"])?.normalizedTerm, "sultan");
  assert.equal(findNavixaVoiceTerm("Please ask Soolthan now", ["sultan"])?.normalizedTerm, "sultan");
});

test("matches Arabic/English code switching and common cross-script name renderings", () => {
  assert.equal(findNavixaVoiceTerm("يا Sultan انت موجود", ["سلطان"])?.normalizedTerm, "سلطان");
  assert.equal(findNavixaVoiceTerm("Sultan جاوب على السؤال", ["سلطان"])?.normalizedTerm, "سلطان");
  assert.equal(findNavixaVoiceTerm("Next is El Harbi", ["الحربي"])?.normalizedTerm, "الحربي");
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
  assert.equal(findNavixaVoiceTerm("Please ask Zoltan now", ["sultan"]), null);
  assert.equal(findNavixaVoiceTerm("Please ask Shelton now", ["sultan"]), null);
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

test("passes a broad accent-transcript hypothesis matrix without nearby-name false positives", () => {
  const positives = [
    { text: "Please call Sultan now", term: "sultan" },
    { text: "Please call Soltan now", term: "sultan" },
    { text: "Please call Sultaan now", term: "sultan" },
    { text: "Please call Sulthan now", term: "sultan" },
    { text: "Please call Sooltan now", term: "sultan" },
    { text: "Please call Soul Tan now", term: "sultan" },
    { text: "يا Sultan لو سمحت", term: "سلطان" },
    { text: "سلطاان جاوب على السؤال", term: "سلطان" },
    { text: "Please ask Mohammed to answer", term: "محمد" },
    { text: "Please ask Mohammad to answer", term: "محمد" },
    { text: "Please ask Mohamed to answer", term: "محمد" },
    { text: "Please ask Muhammed to answer", term: "محمد" },
    { text: "Next is Alharbi", term: "الحربي" },
    { text: "Next is Al Harbi", term: "الحربي" },
    { text: "Next is El Harbi", term: "الحربي" },
    { text: "Next is Alharby", term: "الحربي" },
  ];
  const negatives = [
    { text: "Please ask Salman now", term: "sultan" },
    { text: "Please ask Salim now", term: "sultan" },
    { text: "Please ask Zoltan now", term: "sultan" },
    { text: "Please ask Shelton now", term: "sultan" },
    { text: "The sultanate announced a change", term: "sultan" },
    { text: "Please ask Sullivan now", term: "sultan" },
    { text: "Next is Al Hardy", term: "الحربي" },
    { text: "Please ask Mahmoud", term: "محمد" },
  ];

  for (const sample of positives) {
    assert.ok(findNavixaVoiceTerm(sample.text, [sample.term]), `expected match: ${sample.text} -> ${sample.term}`);
  }
  for (const sample of negatives) {
    assert.equal(findNavixaVoiceTerm(sample.text, [sample.term]), null, `unexpected match: ${sample.text} -> ${sample.term}`);
  }
});
