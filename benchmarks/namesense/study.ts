export type NameSenseStudyNameId = "sultan" | "mohammed" | "alharbi";
export type NameSenseStudyExpected = "hit" | "miss";
export type NameSenseStudyAccent = "en-IN" | "en-PH" | "en-US" | "en-GB" | "ar-GULF" | "ar-EG" | "ar-SY" | "ar-MA" | "ar-DZ";
export type NameSenseStudyPrompt = { id: string; text: string; latencyEligible: boolean };

const NAME_SEQUENCE: NameSenseStudyNameId[] = ["sultan", "mohammed", "alharbi"];

const NAMES: Record<NameSenseStudyNameId, { ar: string; en: string }> = {
  sultan: { ar: "سلطان", en: "Sultan" },
  mohammed: { ar: "محمد", en: "Mohammed" },
  alharbi: { ar: "الحربي", en: "Alharbi" },
};

const POSITIVE_TEMPLATES = [
  { id: "name-only", ar: "{name}", en: "{name}", latencyEligible: true },
  { id: "direct-question", ar: "يا {name} تسمعني؟", en: "{name}, can you hear me?", latencyEligible: false },
  { id: "classroom-answer", ar: "{name} جاوب على السؤال لو سمحت", en: "{name}, answer the question please", latencyEligible: false },
  { id: "mid-sentence", ar: "السؤال الجاي عند {name} وبعده نكمل", en: "The next question is for {name}, then we continue", latencyEligible: false },
  { id: "name-final", ar: "نحتاج إجابتك الآن يا {name}", en: "We need your answer now, {name}", latencyEligible: true },
  { id: "code-switch", ar: "يا {latinName} are you with us?", en: "{latinName} جاوب لو سمحت", latencyEligible: false },
  { id: "repeat-name", ar: "{name}، {name}، تسمعني؟", en: "{name}, {name}, can you hear me?", latencyEligible: false },
] as const;

const NEGATIVES: Record<NameSenseStudyNameId, { ar: string[]; en: string[] }> = {
  sultan: {
    ar: ["يا سلمان جاوب على السؤال", "سليم موجود معنا؟", "نكمل السؤال التالي بدون أسماء"],
    en: ["Please ask Salman now", "Please ask Salim now", "Please ask Zoltan now", "Please ask Shelton now", "Please ask Sullivan now", "The sultanate announced a change"],
  },
  mohammed: {
    ar: ["يا محمود جاوب على السؤال", "حمد موجود معنا؟", "نكمل السؤال التالي بدون أسماء"],
    en: ["Please ask Mahmoud to answer", "Please ask Hamad to answer", "Let's continue with the next slide"],
  },
  alharbi: {
    ar: ["الحارثي موجود؟", "نحتاج إجابة الطالب التالي الآن", "نكمل السؤال التالي بدون أسماء"],
    en: ["Next is Al Hardy", "Please ask Al Harithy now", "Let's continue with the next slide"],
  },
};

const safeTrialCount = (usedTrials: number) => Number.isFinite(usedTrials) && usedTrials >= 0 ? Math.floor(usedTrials) : 0;

export function nextNameSenseStudyAssignment(usedTrials: number): {
  expected: NameSenseStudyExpected;
  nameId: NameSenseStudyNameId;
} {
  const safeCount = safeTrialCount(usedTrials);
  return {
    expected: safeCount % 2 === 0 ? "hit" : "miss",
    nameId: NAME_SEQUENCE[safeCount % NAME_SEQUENCE.length],
  };
}

export function getNameSenseStudyPrompt(
  usedTrials: number,
  accent: NameSenseStudyAccent,
  assignment = nextNameSenseStudyAssignment(usedTrials),
): NameSenseStudyPrompt {
  const safeCount = safeTrialCount(usedTrials);
  const arabic = accent.startsWith("ar-");
  const name = arabic ? NAMES[assignment.nameId].ar : NAMES[assignment.nameId].en;
  const promptIndex = Math.floor(safeCount / 2);

  if (assignment.expected === "hit") {
    const item = POSITIVE_TEMPLATES[promptIndex % POSITIVE_TEMPLATES.length];
    const template = arabic ? item.ar : item.en;
    return {
      id: `${item.id}-${assignment.nameId}`,
      text: template.replaceAll("{name}", name).replaceAll("{latinName}", NAMES[assignment.nameId].en),
      latencyEligible: item.latencyEligible,
    };
  }

  const candidates = arabic ? NEGATIVES[assignment.nameId].ar : NEGATIVES[assignment.nameId].en;
  const index = promptIndex % candidates.length;
  return { id: `negative-${assignment.nameId}-${index + 1}`, text: candidates[index], latencyEligible: false };
}

export function nameSenseStudyPromptMatchesAssignment(
  promptId: unknown,
  assignment: { expected: NameSenseStudyExpected; nameId: NameSenseStudyNameId },
) {
  if (typeof promptId !== "string") return false;
  const normalized = promptId.trim().toLowerCase();
  if (!normalized || !normalized.includes(`-${assignment.nameId}`)) return false;
  return assignment.expected === "miss" ? normalized.startsWith("negative-") : !normalized.startsWith("negative-");
}
