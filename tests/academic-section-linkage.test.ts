import assert from "node:assert/strict";
import test from "node:test";
import "./academic-memory.test.ts";
import "./academic-ingestion.test.ts";
import {
  flattenAcademicRegistrationOptionMeetings,
  isTrustedAcademicLinkage,
  matchAcademicRegistrationOption,
  matchTrustedAcademicRegistrationOption,
  validateAcademicOffering,
  type AcademicCourseOffering,
} from "../app/education/academic-section-linkage.ts";
import { CLASS_SCHEDULE_OFFERINGS } from "../app/config/class-schedule-pilot.ts";

const LINKED_OFFERING: AcademicCourseOffering = {
  offeringId: "it401-region-a-2026",
  courseCode: "IT401",
  courseName: "مقرر تجريبي",
  context: {
    termId: "2026-term-1",
    regionId: "region-a",
    campusId: "campus-a",
    programId: "it",
    planId: "plan-2026",
  },
  components: [
    {
      componentId: "lecture-01",
      componentType: "lecture",
      sectionCode: "L01",
      meetings: [{ meetingId: "lecture-01-sun", days: [0], start: "17:00", end: "17:50", deliveryMode: "online" }],
    },
    {
      componentId: "lab-01",
      componentType: "lab",
      sectionCode: "B01",
      meetings: [{ meetingId: "lab-01-mon", days: [1], start: "18:00", end: "19:40", deliveryMode: "in_person", locationLabel: "معمل 4" }],
    },
    {
      componentId: "lecture-02",
      componentType: "lecture",
      sectionCode: "L02",
      meetings: [{ meetingId: "lecture-02-tue", days: [2], start: "17:00", end: "17:50", deliveryMode: "online" }],
    },
    {
      componentId: "lab-02",
      componentType: "lab",
      sectionCode: "B02",
      meetings: [{ meetingId: "lab-02-wed", days: [3], start: "18:00", end: "19:40", deliveryMode: "in_person", locationLabel: "معمل 6" }],
    },
  ],
  registrationOptions: [
    { optionId: "linked-01", componentIds: ["lecture-01", "lab-01"], evidence: "official" },
    { optionId: "linked-02", componentIds: ["lecture-02", "lab-02"], evidence: "official" },
  ],
};

test("academic linkage accepts only complete official lecture/lab combinations", () => {
  assert.deepEqual(validateAcademicOffering(LINKED_OFFERING), []);
  assert.equal(matchAcademicRegistrationOption(LINKED_OFFERING, ["lecture-01", "lab-01"])?.optionId, "linked-01");
  assert.equal(matchAcademicRegistrationOption(LINKED_OFFERING, ["lab-01", "lecture-01"])?.optionId, "linked-01");
  assert.equal(matchAcademicRegistrationOption(LINKED_OFFERING, ["lecture-01", "lab-02"]), null);
  assert.equal(matchAcademicRegistrationOption(LINKED_OFFERING, ["lecture-01"]), null);
});

test("selected registration option keeps its own lecture/lab meetings and delivery modes", () => {
  const option = matchTrustedAcademicRegistrationOption(LINKED_OFFERING, ["lecture-01", "lab-01"]);
  assert.ok(option);
  const meetings = flattenAcademicRegistrationOptionMeetings(LINKED_OFFERING, option);
  assert.deepEqual(meetings.map(item => item.componentId).sort(), ["lab-01", "lecture-01"]);
  assert.equal(meetings.find(item => item.componentId === "lecture-01")?.deliveryMode, "online");
  assert.equal(meetings.find(item => item.componentId === "lab-01")?.deliveryMode, "in_person");
  assert.equal(meetings.find(item => item.componentId === "lab-01")?.locationLabel, "معمل 4");
});

test("only official or reviewed linkage is trusted for automatic recommendations", () => {
  assert.equal(isTrustedAcademicLinkage({ optionId: "official", componentIds: ["a"], evidence: "official" }), true);
  assert.equal(isTrustedAcademicLinkage({ optionId: "reviewed", componentIds: ["a"], evidence: "reviewed" }), true);
  assert.equal(isTrustedAcademicLinkage({ optionId: "inferred", componentIds: ["a"], evidence: "inferred" }), false);
  assert.equal(isTrustedAcademicLinkage({ optionId: "unknown", componentIds: ["a"], evidence: "unknown" }), false);

  const inferred: AcademicCourseOffering = {
    ...LINKED_OFFERING,
    registrationOptions: [{ optionId: "guess", componentIds: ["lecture-01", "lab-01"], evidence: "inferred" }],
  };
  assert.equal(matchAcademicRegistrationOption(inferred, ["lecture-01", "lab-01"])?.optionId, "guess");
  assert.equal(matchTrustedAcademicRegistrationOption(inferred, ["lecture-01", "lab-01"]), null);
});

test("academic model rejects links to components that do not exist", () => {
  const broken: AcademicCourseOffering = {
    ...LINKED_OFFERING,
    registrationOptions: [{ optionId: "broken", componentIds: ["lecture-01", "missing-lab"], evidence: "official" }],
  };
  const codes = validateAcademicOffering(broken).map(issue => issue.code);
  assert.ok(codes.includes("unknown_component_in_option"));
  assert.ok(codes.includes("orphan_component"));
});

test("current pilot schedule remains internally valid after migration to offerings", () => {
  const issues = CLASS_SCHEDULE_OFFERINGS.flatMap(validateAcademicOffering);
  assert.deepEqual(issues, []);
});
