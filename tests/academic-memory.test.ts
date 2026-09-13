import assert from "node:assert/strict";
import test from "node:test";
import type { AcademicCourseOffering } from "../app/education/academic-section-linkage.ts";
import {
  academicMemoryPartitionKey,
  appendAcademicObservation,
  buildAcademicHistoricalProfile,
  classifyAcademicObservation,
  predictAcademicDeliveryMode,
  sameAcademicMemoryScope,
  selectCurrentAcademicTruth,
  validateAcademicObservation,
  type AcademicMemoryScope,
  type AcademicOfferingObservation,
  type AcademicTermRef,
} from "../app/education/academic-memory.ts";

const TARGET_TERM: AcademicTermRef = { termId: "2027-t1", startsOn: "2027-08-20", endsOn: "2027-12-20" };
const BASE_SCOPE: AcademicMemoryScope = {
  institutionId: "university-1",
  courseIdentityId: "course-it401",
  regionId: "region-a",
  campusId: "campus-a",
  collegeId: "computing",
  programId: "it",
  planId: "plan-2026",
  trackId: "general",
  levelId: "4",
};

function offering(termId: string, code: string, lectureMode: "online" | "in_person" | "hybrid", labMode: "online" | "in_person" | "hybrid"): AcademicCourseOffering {
  return {
    offeringId: `${termId}-${code}`,
    courseCode: code,
    courseName: "مقرر تجريبي",
    context: {
      termId,
      regionId: "region-a",
      campusId: "campus-a",
      programId: "it",
      planId: "plan-2026",
    },
    components: [
      {
        componentId: `${termId}-lecture`,
        componentType: "lecture",
        meetings: [{
          meetingId: `${termId}-lecture-weekly`,
          days: [0, 2],
          start: "17:00",
          end: "17:50",
          deliveryMode: lectureMode,
        }],
      },
      {
        componentId: `${termId}-lab`,
        componentType: "lab",
        meetings: [{
          meetingId: `${termId}-lab-weekly`,
          days: [1],
          start: "18:00",
          end: "19:40",
          deliveryMode: labMode,
          locationLabel: labMode === "in_person" ? "معمل 4" : undefined,
        }],
      },
    ],
    registrationOptions: [{
      optionId: `${termId}-primary`,
      componentIds: [`${termId}-lecture`, `${termId}-lab`],
      evidence: "official",
    }],
  };
}

function observation(
  observationId: string,
  term: AcademicTermRef,
  code = "IT401",
  authority: AcademicOfferingObservation["evidence"]["authority"] = "official",
  observedAt = `${term.startsOn}T08:00:00Z`,
  scope: AcademicMemoryScope = BASE_SCOPE,
  lectureMode: "online" | "in_person" | "hybrid" = "online",
  labMode: "online" | "in_person" | "hybrid" = "in_person",
): AcademicOfferingObservation {
  return {
    recordKind: "observation",
    observationId,
    scope,
    term,
    courseCodeAtObservation: code,
    courseNameAtObservation: "مقرر تجريبي",
    offering: offering(term.termId, code, lectureMode, labMode),
    evidence: {
      sourceId: `source-${observationId}`,
      kind: authority === "official" ? "official_portal" : authority === "reviewed" ? "manual_review" : authority === "derived" ? "historical_pattern" : "student_import",
      authority,
      observedAt,
      confidence: authority === "derived" ? 0.8 : 1,
    },
  };
}

test("academic memory never merges the same course across different regions, campuses, or plans", () => {
  const otherRegion = { ...BASE_SCOPE, regionId: "region-b" };
  const otherCampus = { ...BASE_SCOPE, campusId: "campus-b" };
  const otherPlan = { ...BASE_SCOPE, planId: "plan-2027" };
  assert.equal(sameAcademicMemoryScope(BASE_SCOPE, otherRegion), false);
  assert.equal(sameAcademicMemoryScope(BASE_SCOPE, otherCampus), false);
  assert.equal(sameAcademicMemoryScope(BASE_SCOPE, otherPlan), false);
  assert.notEqual(academicMemoryPartitionKey(BASE_SCOPE), academicMemoryPartitionKey(otherRegion));
});

test("stable course identity keeps history connected even if the visible course code changes", () => {
  const oldTerm = { termId: "2026-t1", startsOn: "2026-08-20" };
  const oldRecord = observation("old-code", oldTerm, "OLD401");
  const newRecord = observation("new-code", TARGET_TERM, "IT401");
  assert.equal(sameAcademicMemoryScope(oldRecord.scope, newRecord.scope), true);
  assert.notEqual(oldRecord.courseCodeAtObservation, newRecord.courseCodeAtObservation);
});

test("academic observations are append-only and current truth does not delete older snapshots", () => {
  const first = observation("current-1", TARGET_TERM, "IT401", "reviewed", "2027-08-21T08:00:00Z");
  const second = observation("current-2", TARGET_TERM, "IT401", "official", "2027-08-20T08:00:00Z");
  const history = appendAcademicObservation(appendAcademicObservation([], first), second);
  assert.equal(history.length, 2);
  assert.equal(selectCurrentAcademicTruth(history, BASE_SCOPE, TARGET_TERM)?.observationId, "current-2");
  assert.throws(() => appendAcademicObservation(history, second), /Duplicate academic observation id/);
});

test("derived or self-reported data can be stored but cannot become current truth automatically", () => {
  const derived = observation("derived", TARGET_TERM, "IT401", "derived");
  const selfReported = observation("self", TARGET_TERM, "IT401", "self_reported");
  assert.equal(selectCurrentAcademicTruth([derived, selfReported], BASE_SCOPE, TARGET_TERM), null);
});

test("historical profile uses trusted prior terms from the exact scope only", () => {
  const term1 = { termId: "2025-t1", startsOn: "2025-08-20" };
  const term2 = { termId: "2026-t1", startsOn: "2026-08-20" };
  const regionB = { ...BASE_SCOPE, regionId: "region-b" };
  const records = [
    observation("a-2025", term1, "IT401", "official", "2025-08-21T08:00:00Z", BASE_SCOPE, "online", "in_person"),
    observation("a-2026", term2, "IT401", "reviewed", "2026-08-21T08:00:00Z", BASE_SCOPE, "online", "in_person"),
    observation("b-2026", term2, "IT401", "official", "2026-08-21T08:00:00Z", regionB, "in_person", "in_person"),
    observation("derived-a", term2, "IT401", "derived", "2026-08-22T08:00:00Z", BASE_SCOPE, "in_person", "online"),
  ];
  const profile = buildAcademicHistoricalProfile(records, BASE_SCOPE, TARGET_TERM);
  assert.deepEqual(profile.observationIds, ["a-2025", "a-2026"]);
  assert.deepEqual(profile.termIds, ["2025-t1", "2026-t1"]);
  const lecture = profile.components.find(item => item.componentType === "lecture");
  const lab = profile.components.find(item => item.componentType === "lab");
  assert.deepEqual(lecture?.deliveryCounts, { in_person: 0, online: 2, hybrid: 0 });
  assert.deepEqual(lab?.deliveryCounts, { in_person: 2, online: 0, hybrid: 0 });
});

test("historical delivery pattern remains an explicit prediction and never masquerades as current fact", () => {
  const term1 = { termId: "2025-t1", startsOn: "2025-08-20" };
  const term2 = { termId: "2026-t1", startsOn: "2026-08-20" };
  const profile = buildAcademicHistoricalProfile([
    observation("p1", term1),
    observation("p2", term2),
  ], BASE_SCOPE, TARGET_TERM);
  const prediction = predictAcademicDeliveryMode(profile, BASE_SCOPE, TARGET_TERM, "lecture", "2027-06-01T10:00:00Z");
  assert.equal(prediction?.recordKind, "prediction");
  assert.equal(prediction?.predictedDeliveryMode, "online");
  assert.equal(prediction?.confidence, 1);
  assert.equal(selectCurrentAcademicTruth([], BASE_SCOPE, TARGET_TERM), null);
});

test("observation classification uses term dates and context mismatches are rejected", () => {
  const historical = observation("history", { termId: "2026-t1", startsOn: "2026-08-20" });
  assert.equal(classifyAcademicObservation(historical, TARGET_TERM), "historical");
  assert.equal(classifyAcademicObservation(observation("current", TARGET_TERM), TARGET_TERM), "current");
  const badScope = { ...BASE_SCOPE, regionId: "region-b" };
  const mismatched = observation("mismatch", TARGET_TERM, "IT401", "official", "2027-08-21T08:00:00Z", badScope);
  assert.ok(validateAcademicObservation(mismatched).some(issue => issue.code === "region_context_mismatch"));
});
