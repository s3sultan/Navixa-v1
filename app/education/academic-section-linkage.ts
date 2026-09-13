export type AcademicComponentType = "lecture" | "lab" | "tutorial" | "practicum" | "seminar";
export type AcademicDeliveryMode = "in_person" | "online" | "hybrid";
export type AcademicLinkageEvidence = "official" | "reviewed" | "inferred" | "unknown";

export type AcademicOfferingContext = {
  termId?: string;
  regionId?: string;
  campusId?: string;
  programId?: string;
  planId?: string;
};

export type AcademicMeeting = {
  meetingId: string;
  days: readonly number[];
  start: string;
  end: string;
  deliveryMode: AcademicDeliveryMode;
  locationLabel?: string;
};

export type AcademicSectionComponent = {
  componentId: string;
  componentType: AcademicComponentType;
  sectionCode?: string;
  crn?: string;
  meetings: readonly AcademicMeeting[];
};

export type AcademicRegistrationOption = {
  optionId: string;
  componentIds: readonly string[];
  evidence: AcademicLinkageEvidence;
};

export type AcademicCourseOffering = {
  offeringId: string;
  courseCode: string;
  courseName: string;
  context?: AcademicOfferingContext;
  components: readonly AcademicSectionComponent[];
  registrationOptions: readonly AcademicRegistrationOption[];
};

export type AcademicOfferingIssueCode =
  | "duplicate_component_id"
  | "duplicate_meeting_id"
  | "duplicate_option_id"
  | "empty_registration_option"
  | "duplicate_component_in_option"
  | "unknown_component_in_option"
  | "orphan_component"
  | "invalid_weekday"
  | "invalid_time_range";

export type AcademicOfferingIssue = {
  code: AcademicOfferingIssueCode;
  detail: string;
};

export type AcademicScheduledMeeting = AcademicMeeting & {
  offeringId: string;
  code: string;
  name: string;
  componentId: string;
  componentType: AcademicComponentType;
  sectionCode?: string;
  crn?: string;
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function flattenComponents(
  offering: AcademicCourseOffering,
  components: readonly AcademicSectionComponent[],
): AcademicScheduledMeeting[] {
  return components.flatMap(component => component.meetings.map(meeting => ({
    ...meeting,
    offeringId: offering.offeringId,
    code: offering.courseCode,
    name: offering.courseName,
    componentId: component.componentId,
    componentType: component.componentType,
    sectionCode: component.sectionCode,
    crn: component.crn,
  })));
}

export function academicDeliveryModeLabel(mode: AcademicDeliveryMode) {
  if (mode === "in_person") return "حضوري";
  if (mode === "hybrid") return "مدمج";
  return "عن بُعد";
}

export function academicComponentTypeLabel(type: AcademicComponentType) {
  if (type === "lab") return "معمل";
  if (type === "tutorial") return "تمارين";
  if (type === "practicum") return "تطبيق عملي";
  if (type === "seminar") return "حلقة نقاش";
  return "محاضرة";
}

export function isTrustedAcademicLinkage(option: AcademicRegistrationOption) {
  return option.evidence === "official" || option.evidence === "reviewed";
}

export function validateAcademicOffering(offering: AcademicCourseOffering): AcademicOfferingIssue[] {
  const issues: AcademicOfferingIssue[] = [];
  const componentIds = new Set<string>();
  const meetingIds = new Set<string>();
  const optionIds = new Set<string>();
  const referencedComponents = new Set<string>();

  for (const component of offering.components) {
    if (componentIds.has(component.componentId)) {
      issues.push({ code: "duplicate_component_id", detail: component.componentId });
    }
    componentIds.add(component.componentId);

    for (const meeting of component.meetings) {
      if (meetingIds.has(meeting.meetingId)) {
        issues.push({ code: "duplicate_meeting_id", detail: meeting.meetingId });
      }
      meetingIds.add(meeting.meetingId);

      if (!meeting.days.length || meeting.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
        issues.push({ code: "invalid_weekday", detail: meeting.meetingId });
      }
      if (!TIME_PATTERN.test(meeting.start) || !TIME_PATTERN.test(meeting.end) || minutes(meeting.end) <= minutes(meeting.start)) {
        issues.push({ code: "invalid_time_range", detail: meeting.meetingId });
      }
    }
  }

  for (const option of offering.registrationOptions) {
    if (optionIds.has(option.optionId)) {
      issues.push({ code: "duplicate_option_id", detail: option.optionId });
    }
    optionIds.add(option.optionId);

    if (!option.componentIds.length) {
      issues.push({ code: "empty_registration_option", detail: option.optionId });
      continue;
    }

    const optionComponents = new Set<string>();
    for (const componentId of option.componentIds) {
      if (optionComponents.has(componentId)) {
        issues.push({ code: "duplicate_component_in_option", detail: `${option.optionId}:${componentId}` });
      }
      optionComponents.add(componentId);
      referencedComponents.add(componentId);
      if (!componentIds.has(componentId)) {
        issues.push({ code: "unknown_component_in_option", detail: `${option.optionId}:${componentId}` });
      }
    }
  }

  for (const componentId of componentIds) {
    if (!referencedComponents.has(componentId)) {
      issues.push({ code: "orphan_component", detail: componentId });
    }
  }

  return issues;
}

export function matchAcademicRegistrationOption(
  offering: AcademicCourseOffering,
  selectedComponentIds: readonly string[],
): AcademicRegistrationOption | null {
  if (!selectedComponentIds.length || new Set(selectedComponentIds).size !== selectedComponentIds.length) return null;
  const selected = new Set(selectedComponentIds);
  return offering.registrationOptions.find(option =>
    option.componentIds.length === selected.size && option.componentIds.every(componentId => selected.has(componentId)),
  ) || null;
}

export function matchTrustedAcademicRegistrationOption(
  offering: AcademicCourseOffering,
  selectedComponentIds: readonly string[],
): AcademicRegistrationOption | null {
  const option = matchAcademicRegistrationOption(offering, selectedComponentIds);
  return option && isTrustedAcademicLinkage(option) ? option : null;
}

export function flattenAcademicRegistrationOptionMeetings(
  offering: AcademicCourseOffering,
  option: AcademicRegistrationOption,
): AcademicScheduledMeeting[] {
  const selected = new Set(option.componentIds);
  return flattenComponents(offering, offering.components.filter(component => selected.has(component.componentId)));
}

export function flattenAcademicOfferingMeetings(offering: AcademicCourseOffering): AcademicScheduledMeeting[] {
  return flattenComponents(offering, offering.components);
}
