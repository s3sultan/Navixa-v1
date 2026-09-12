export type NameSenseStudyNameId = "sultan" | "mohammed" | "alharbi";
export type NameSenseStudyExpected = "hit" | "miss";

const NAME_SEQUENCE: NameSenseStudyNameId[] = ["sultan", "mohammed", "alharbi"];

export function nextNameSenseStudyAssignment(usedTrials: number): {
  expected: NameSenseStudyExpected;
  nameId: NameSenseStudyNameId;
} {
  const safeCount = Number.isFinite(usedTrials) && usedTrials >= 0 ? Math.floor(usedTrials) : 0;
  return {
    expected: safeCount % 2 === 0 ? "hit" : "miss",
    nameId: NAME_SEQUENCE[safeCount % NAME_SEQUENCE.length],
  };
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
