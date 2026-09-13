import {
  flattenAcademicOfferingMeetings,
  validateAcademicOffering,
  type AcademicCourseOffering,
  type AcademicScheduledMeeting,
} from "../education/academic-section-linkage.ts";

export type ClassScheduleItem = AcademicScheduledMeeting;

export const CLASS_SCHEDULE_TIMEZONE = "Asia/Riyadh";
export const CLASS_SCHEDULE_REMINDERS = [60, 30, 10] as const;

// Weekly classes stop recurring before the university final-exam period begins.
// 2026-12-12 23:59:59 Asia/Riyadh = 2026-12-12 20:59:59 UTC.
export const CLASS_SCHEDULE_RECURRENCE_UNTIL_UTC = "20261212T205959Z";
export const CLASS_SCHEDULE_LAST_LECTURE_DATE = "2026-12-12";

function lectureOffering(
  code: string,
  name: string,
  days: readonly number[],
  start: string,
  end: string,
): AcademicCourseOffering {
  const componentId = `${code}-lecture`;
  return {
    offeringId: `pilot-${code}`,
    courseCode: code,
    courseName: name,
    context: { termId: "pilot-2026" },
    components: [{
      componentId,
      componentType: "lecture",
      meetings: [{
        meetingId: `${componentId}-weekly`,
        days,
        start,
        end,
        deliveryMode: "online",
      }],
    }],
    registrationOptions: [{
      optionId: `${code}-primary`,
      componentIds: [componentId],
      evidence: "reviewed",
    }],
  };
}

export const CLASS_SCHEDULE_OFFERINGS: readonly AcademicCourseOffering[] = [
  lectureOffering("101", "الفيزياء العامة 1", [0, 2], "15:00", "15:50"),
  lectureOffering("232", "البرمجة كائنية التوجه", [1, 3], "16:00", "16:50"),
  lectureOffering("231", "مقدمة في تقنية ونظم المعلومات", [0, 3], "17:00", "17:50"),
  lectureOffering("150", "الرياضيات المتقطعة", [1, 3], "18:00", "18:50"),
  lectureOffering("233", "تنظيم الحاسب", [1, 3], "19:00", "19:50"),
];

const scheduleIssues = CLASS_SCHEDULE_OFFERINGS.flatMap(validateAcademicOffering);
if (scheduleIssues.length) {
  throw new Error(`Invalid academic schedule model: ${scheduleIssues.map(issue => `${issue.code}:${issue.detail}`).join(", ")}`);
}

export const CLASS_SCHEDULE_CLASSES: readonly ClassScheduleItem[] = CLASS_SCHEDULE_OFFERINGS.flatMap(flattenAcademicOfferingMeetings);
