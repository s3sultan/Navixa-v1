import assert from "node:assert/strict";
import test from "node:test";
import {
  academicIngestionToObservation,
  evaluateAcademicIngestion,
  validateAcademicInstitutionRegistry,
  type AcademicIngestionCandidate,
  type AcademicInstitutionRegistry,
} from "../app/education/academic-ingestion.ts";
import type { AcademicCourseOffering } from "../app/education/academic-section-linkage.ts";

const REGISTRY: AcademicInstitutionRegistry = [
  {
    institutionId: "institution-a",
    names: ["الجامعة أ", "University A"],
    officialDomains: ["a.edu.sa"],
    sources: [
      {
        sourceId: "institution-a-portal",
        kind: "official_portal",
        authority: "official",
        channels: ["api", "portal", "pdf", "csv"],
        allowedHosts: ["portal.a.edu.sa"],
      },
      {
        sourceId: "institution-a-review",
        kind: "manual_review",
        authority: "reviewed",
        channels: ["manual"],
      },
    ],
  },
  {
    institutionId: "institution-b",
    names: ["الجامعة ب", "University B"],
    officialDomains: ["b.edu.sa"],
    sources: [
      {
        sourceId: "institution-b-portal",
        kind: "official_portal",
        authority: "official",
        channels: ["api", "portal", "pdf", "csv"],
        allowedHosts: ["portal.b.edu.sa"],
      },
    ],
  },
];

function offering(
  offeringId: string,
  courseCode = "IT401",
  courseName = "مقرر مشترك الاسم",
): AcademicCourseOffering {
  return {
    offeringId,
    courseCode,
    courseName,
    context: {
      termId: "2026-term-1",
      regionId: "region-1",
      campusId: "campus-1",
      programId: "it",
      planId: "plan-2026",
    },
    components: [{
      componentId: `${offeringId}-lecture-01`,
      componentType: "lecture",
      sectionCode: "L01",
      meetings: [{
        meetingId: `${offeringId}-meeting-01`,
        days: [0, 2],
        start: "17:00",
        end: "17:50",
        deliveryMode: "online",
      }],
    }],
    registrationOptions: [{
      optionId: `${offeringId}-option-01`,
      componentIds: [`${offeringId}-lecture-01`],
      evidence: "official",
    }],
  };
}

function candidate(
  institutionId: "institution-a" | "institution-b" = "institution-a",
): AcademicIngestionCandidate {
  const sourceId = institutionId === "institution-a" ? "institution-a-portal" : "institution-b-portal";
  const host = institutionId === "institution-a" ? "portal.a.edu.sa" : "portal.b.edu.sa";
  return {
    candidateId: `${institutionId}-it401-2026-1`,
    institutionId,
    courseIdentityId: "course-it401",
    courseCode: "IT401",
    courseName: "مقرر مشترك الاسم",
    term: { termId: "2026-term-1", startsOn: "2026-08-20", endsOn: "2026-12-20" },
    context: {
      regionId: "region-1",
      campusId: "campus-1",
      programId: "it",
      planId: "plan-2026",
    },
    offering: offering(`${institutionId}-it401`),
    source: {
      sourceId,
      channel: "portal",
      sourceUri: `https://${host}/registration/IT401`,
      observedAt: "2026-09-13T03:00:00Z",
    },
    extraction: { method: "structured" },
  };
}

test("multi-university registry keeps institution sources explicit and valid", () => {
  assert.deepEqual(validateAcademicInstitutionRegistry(REGISTRY), []);
});

test("registry rejects a source host outside its university official domains", () => {
  const broken: AcademicInstitutionRegistry = [{
    institutionId: "institution-a",
    names: ["University A"],
    officialDomains: ["a.edu.sa"],
    sources: [{
      sourceId: "bad-source",
      kind: "official_portal",
      authority: "official",
      channels: ["portal"],
      allowedHosts: ["portal.attacker.example"],
    }],
  }];
  const codes = validateAcademicInstitutionRegistry(broken).map(issue => issue.code);
  assert.ok(codes.includes("source_host_outside_institution_domain"));
});

test("fully resolved structured data from the registered official source is accepted", () => {
  const value = candidate("institution-a");
  const decision = evaluateAcademicIngestion(REGISTRY, value);
  assert.equal(decision.status, "accept");
  assert.equal(decision.sourceAuthority, "official");

  const observation = academicIngestionToObservation(REGISTRY, value);
  assert.ok(observation);
  assert.equal(observation.scope.institutionId, "institution-a");
  assert.equal(observation.scope.courseIdentityId, "course-it401");
  assert.equal(observation.evidence.sourceId, "institution-a-portal");
});

test("same course code and identity label in two universities remain separate observations", () => {
  const a = academicIngestionToObservation(REGISTRY, candidate("institution-a"));
  const b = academicIngestionToObservation(REGISTRY, candidate("institution-b"));
  assert.ok(a);
  assert.ok(b);
  assert.equal(a.courseCodeAtObservation, b.courseCodeAtObservation);
  assert.equal(a.scope.courseIdentityId, b.scope.courseIdentityId);
  assert.notEqual(a.scope.institutionId, b.scope.institutionId);
});

test("a source registered to one university cannot feed another university", () => {
  const value = candidate("institution-b");
  value.source = {
    ...value.source,
    sourceId: "institution-a-portal",
    sourceUri: "https://portal.a.edu.sa/registration/IT401",
  };
  const decision = evaluateAcademicIngestion(REGISTRY, value);
  assert.equal(decision.status, "reject");
  assert.ok(decision.reasons.some(reason => reason.code === "source_institution_mismatch"));
});

test("official source rejects lookalike or unrelated hosts", () => {
  const value = candidate("institution-a");
  value.source = {
    ...value.source,
    sourceUri: "https://portal.a.edu.sa.attacker.example/registration/IT401",
  };
  const decision = evaluateAcademicIngestion(REGISTRY, value);
  assert.equal(decision.status, "reject");
  assert.ok(decision.reasons.some(reason => reason.code === "source_host_mismatch"));
});

test("OCR stays review-only even when the document came from an official university host", () => {
  const value = candidate("institution-a");
  value.source = { ...value.source, channel: "pdf" };
  value.extraction = { method: "ocr", confidence: 0.99 };
  const decision = evaluateAcademicIngestion(REGISTRY, value);
  assert.equal(decision.status, "review");
  assert.ok(decision.reasons.some(reason => reason.code === "ocr_requires_review"));
  assert.equal(academicIngestionToObservation(REGISTRY, value), null);
});

test("ambiguous branch, region, or plan is never guessed into the memory", () => {
  const value = candidate("institution-a");
  value.unresolvedContext = ["region", "plan"];
  const decision = evaluateAcademicIngestion(REGISTRY, value);
  assert.equal(decision.status, "review");
  assert.deepEqual(
    decision.reasons.filter(reason => reason.code === "unresolved_context").map(reason => reason.detail).sort(),
    ["plan", "region"],
  );
});

test("unregistered student or manual imports can enter review but cannot become current truth directly", () => {
  const value = candidate("institution-a");
  value.source = {
    sourceId: "student-upload-123",
    channel: "manual",
    observedAt: "2026-09-13T03:00:00Z",
  };
  value.extraction = { method: "manual" };
  const decision = evaluateAcademicIngestion(REGISTRY, value);
  assert.equal(decision.status, "review");
  assert.ok(decision.reasons.some(reason => reason.code === "unregistered_source"));
  assert.ok(decision.reasons.some(reason => reason.code === "manual_requires_review"));
});

test("a registered human review source can approve a manually verified record", () => {
  const value = candidate("institution-a");
  value.source = {
    sourceId: "institution-a-review",
    channel: "manual",
    observedAt: "2026-09-13T03:10:00Z",
  };
  value.extraction = { method: "manual" };
  const decision = evaluateAcademicIngestion(REGISTRY, value);
  assert.equal(decision.status, "accept");
  assert.equal(decision.sourceAuthority, "reviewed");
});

test("unknown universities are rejected instead of being matched by course name", () => {
  const value = candidate("institution-a");
  value.institutionId = "institution-unknown";
  const decision = evaluateAcademicIngestion(REGISTRY, value);
  assert.equal(decision.status, "reject");
  assert.ok(decision.reasons.some(reason => reason.code === "unknown_institution"));
});
