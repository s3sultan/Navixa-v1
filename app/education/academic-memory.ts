import {
  flattenAcademicOfferingMeetings,
  type AcademicComponentType,
  type AcademicCourseOffering,
  type AcademicDeliveryMode,
} from "./academic-section-linkage.ts";

export type AcademicSourceAuthority = "official" | "reviewed" | "self_reported" | "derived";
export type AcademicSourceKind =
  | "official_portal"
  | "official_document"
  | "faculty_notice"
  | "student_import"
  | "manual_review"
  | "historical_pattern";

export type AcademicSourceEvidence = {
  sourceId: string;
  kind: AcademicSourceKind;
  authority: AcademicSourceAuthority;
  observedAt: string;
  confidence?: number;
};

export type AcademicTermRef = {
  termId: string;
  startsOn: string;
  endsOn?: string;
};

export type AcademicMemoryScope = {
  institutionId: string;
  courseIdentityId: string;
  regionId?: string;
  campusId?: string;
  collegeId?: string;
  programId?: string;
  planId?: string;
  trackId?: string;
  levelId?: string;
};

export type AcademicOfferingObservation = {
  recordKind: "observation";
  observationId: string;
  scope: AcademicMemoryScope;
  term: AcademicTermRef;
  courseCodeAtObservation: string;
  courseNameAtObservation: string;
  offering: AcademicCourseOffering;
  evidence: AcademicSourceEvidence;
};

export type AcademicDeliveryPrediction = {
  recordKind: "prediction";
  predictionId: string;
  scope: AcademicMemoryScope;
  targetTerm: AcademicTermRef;
  componentType: AcademicComponentType;
  predictedDeliveryMode: AcademicDeliveryMode;
  generatedAt: string;
  confidence: number;
  basedOnObservationIds: readonly string[];
};

export type AcademicObservationState = "current" | "historical" | "future";

export type AcademicMemoryIssueCode =
  | "missing_identity"
  | "invalid_term_date"
  | "invalid_observed_at"
  | "invalid_confidence"
  | "term_context_mismatch"
  | "region_context_mismatch"
  | "campus_context_mismatch"
  | "program_context_mismatch"
  | "plan_context_mismatch"
  | "course_code_mismatch";

export type AcademicMemoryIssue = {
  code: AcademicMemoryIssueCode;
  detail: string;
};

export type AcademicHistoricalComponentProfile = {
  componentType: AcademicComponentType;
  meetingsObserved: number;
  deliveryCounts: Record<AcademicDeliveryMode, number>;
};

export type AcademicHistoricalProfile = {
  profileKind: "historical_profile";
  partitionKey: string;
  courseIdentityId: string;
  targetTermId: string;
  observationIds: readonly string[];
  termIds: readonly string[];
  components: readonly AcademicHistoricalComponentProfile[];
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AUTHORITY_RANK: Record<AcademicSourceAuthority, number> = {
  official: 4,
  reviewed: 3,
  self_reported: 2,
  derived: 1,
};

function validDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function validDateTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function cleanIdentity(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function academicMemoryPartitionKey(scope: AcademicMemoryScope) {
  return JSON.stringify([
    ["institution", cleanIdentity(scope.institutionId)],
    ["course", cleanIdentity(scope.courseIdentityId)],
    ["region", cleanIdentity(scope.regionId)],
    ["campus", cleanIdentity(scope.campusId)],
    ["college", cleanIdentity(scope.collegeId)],
    ["program", cleanIdentity(scope.programId)],
    ["plan", cleanIdentity(scope.planId)],
    ["track", cleanIdentity(scope.trackId)],
    ["level", cleanIdentity(scope.levelId)],
  ]);
}

export function sameAcademicMemoryScope(left: AcademicMemoryScope, right: AcademicMemoryScope) {
  return academicMemoryPartitionKey(left) === academicMemoryPartitionKey(right);
}

export function academicTermScopeKey(scope: AcademicMemoryScope, termId: string) {
  return JSON.stringify([academicMemoryPartitionKey(scope), cleanIdentity(termId)]);
}

export function isTrustedAcademicFactSource(evidence: AcademicSourceEvidence) {
  return evidence.authority === "official" || evidence.authority === "reviewed";
}

export function validateAcademicObservation(observation: AcademicOfferingObservation): AcademicMemoryIssue[] {
  const issues: AcademicMemoryIssue[] = [];
  const required = [
    observation.observationId,
    observation.scope.institutionId,
    observation.scope.courseIdentityId,
    observation.term.termId,
    observation.courseCodeAtObservation,
    observation.courseNameAtObservation,
    observation.evidence.sourceId,
  ];
  if (required.some(value => !cleanIdentity(value))) {
    issues.push({ code: "missing_identity", detail: observation.observationId || "observation" });
  }

  if (!validDate(observation.term.startsOn) || (observation.term.endsOn && !validDate(observation.term.endsOn))) {
    issues.push({ code: "invalid_term_date", detail: observation.term.termId });
  }
  if (!validDateTime(observation.evidence.observedAt)) {
    issues.push({ code: "invalid_observed_at", detail: observation.evidence.observedAt });
  }
  if (observation.evidence.confidence !== undefined && (
    !Number.isFinite(observation.evidence.confidence) ||
    observation.evidence.confidence < 0 ||
    observation.evidence.confidence > 1
  )) {
    issues.push({ code: "invalid_confidence", detail: String(observation.evidence.confidence) });
  }

  const context = observation.offering.context;
  if (context?.termId && context.termId !== observation.term.termId) {
    issues.push({ code: "term_context_mismatch", detail: `${context.termId}:${observation.term.termId}` });
  }
  if (context?.regionId && context.regionId !== observation.scope.regionId) {
    issues.push({ code: "region_context_mismatch", detail: `${context.regionId}:${observation.scope.regionId || "unknown"}` });
  }
  if (context?.campusId && context.campusId !== observation.scope.campusId) {
    issues.push({ code: "campus_context_mismatch", detail: `${context.campusId}:${observation.scope.campusId || "unknown"}` });
  }
  if (context?.programId && context.programId !== observation.scope.programId) {
    issues.push({ code: "program_context_mismatch", detail: `${context.programId}:${observation.scope.programId || "unknown"}` });
  }
  if (context?.planId && context.planId !== observation.scope.planId) {
    issues.push({ code: "plan_context_mismatch", detail: `${context.planId}:${observation.scope.planId || "unknown"}` });
  }
  if (observation.offering.courseCode !== observation.courseCodeAtObservation) {
    issues.push({ code: "course_code_mismatch", detail: `${observation.offering.courseCode}:${observation.courseCodeAtObservation}` });
  }

  return issues;
}

export function classifyAcademicObservation(
  observation: AcademicOfferingObservation,
  targetTerm: AcademicTermRef,
): AcademicObservationState {
  if (observation.term.termId === targetTerm.termId) return "current";
  const observationStart = Date.parse(`${observation.term.startsOn}T00:00:00Z`);
  const targetStart = Date.parse(`${targetTerm.startsOn}T00:00:00Z`);
  if (!Number.isFinite(observationStart) || !Number.isFinite(targetStart)) return "future";
  return observationStart < targetStart ? "historical" : "future";
}

export function appendAcademicObservation(
  history: readonly AcademicOfferingObservation[],
  next: AcademicOfferingObservation,
) {
  if (history.some(item => item.observationId === next.observationId)) {
    throw new Error(`Duplicate academic observation id: ${next.observationId}`);
  }
  return [...history, next];
}

export function selectCurrentAcademicTruth(
  observations: readonly AcademicOfferingObservation[],
  scope: AcademicMemoryScope,
  targetTerm: AcademicTermRef,
): AcademicOfferingObservation | null {
  return observations
    .filter(observation =>
      validateAcademicObservation(observation).length === 0 &&
      sameAcademicMemoryScope(observation.scope, scope) &&
      observation.term.termId === targetTerm.termId &&
      isTrustedAcademicFactSource(observation.evidence)
    )
    .sort((left, right) => {
      const authority = AUTHORITY_RANK[right.evidence.authority] - AUTHORITY_RANK[left.evidence.authority];
      if (authority !== 0) return authority;
      return Date.parse(right.evidence.observedAt) - Date.parse(left.evidence.observedAt);
    })[0] || null;
}

export function buildAcademicHistoricalProfile(
  observations: readonly AcademicOfferingObservation[],
  scope: AcademicMemoryScope,
  targetTerm: AcademicTermRef,
): AcademicHistoricalProfile {
  const eligible = observations.filter(observation =>
    validateAcademicObservation(observation).length === 0 &&
    sameAcademicMemoryScope(observation.scope, scope) &&
    classifyAcademicObservation(observation, targetTerm) === "historical" &&
    isTrustedAcademicFactSource(observation.evidence)
  );

  const counts = new Map<AcademicComponentType, Record<AcademicDeliveryMode, number>>();
  for (const observation of eligible) {
    for (const meeting of flattenAcademicOfferingMeetings(observation.offering)) {
      const bucket = counts.get(meeting.componentType) || { in_person: 0, online: 0, hybrid: 0 };
      bucket[meeting.deliveryMode] += 1;
      counts.set(meeting.componentType, bucket);
    }
  }

  const components = [...counts.entries()]
    .map(([componentType, deliveryCounts]) => ({
      componentType,
      meetingsObserved: deliveryCounts.in_person + deliveryCounts.online + deliveryCounts.hybrid,
      deliveryCounts: { ...deliveryCounts },
    }))
    .sort((left, right) => left.componentType.localeCompare(right.componentType));

  return {
    profileKind: "historical_profile",
    partitionKey: academicMemoryPartitionKey(scope),
    courseIdentityId: scope.courseIdentityId,
    targetTermId: targetTerm.termId,
    observationIds: eligible.map(item => item.observationId),
    termIds: [...new Set(eligible.map(item => item.term.termId))],
    components,
  };
}

export function predictAcademicDeliveryMode(
  profile: AcademicHistoricalProfile,
  scope: AcademicMemoryScope,
  targetTerm: AcademicTermRef,
  componentType: AcademicComponentType,
  generatedAt: string,
): AcademicDeliveryPrediction | null {
  if (profile.partitionKey !== academicMemoryPartitionKey(scope) || profile.targetTermId !== targetTerm.termId) return null;
  if (!validDateTime(generatedAt)) return null;
  const component = profile.components.find(item => item.componentType === componentType);
  if (!component || component.meetingsObserved < 2) return null;

  const ranked = (Object.entries(component.deliveryCounts) as [AcademicDeliveryMode, number][])
    .sort((left, right) => right[1] - left[1]);
  if (!ranked[0] || ranked[0][1] === 0 || ranked[0][1] === ranked[1]?.[1]) return null;

  const predictedDeliveryMode = ranked[0][0];
  return {
    recordKind: "prediction",
    predictionId: `delivery:${scope.courseIdentityId}:${targetTerm.termId}:${componentType}`,
    scope,
    targetTerm,
    componentType,
    predictedDeliveryMode,
    generatedAt,
    confidence: ranked[0][1] / component.meetingsObserved,
    basedOnObservationIds: profile.observationIds,
  };
}
