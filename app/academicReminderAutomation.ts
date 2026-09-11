import {
  AutomationEngine,
  InMemoryRunHistoryStore,
  SkillRegistry,
  type AutomationRun,
} from "../lib/navixa-core/index.ts";
import { persistAutomationRunBestEffort } from "./automationRunHistoryClient.ts";
import { saveAcademicReminder, type AcademicReminder } from "./academicReminders.ts";

const ACADEMIC_REMINDER_SKILL_ID = "academic.reminder.local";
const ACADEMIC_REMINDER_AUTOMATION_ID = "academic.reminder.reviewed";

type AcademicReminderInput = Readonly<{ title: string; date: string }>;
type ReminderRequest = Readonly<{ requestId: string }>;

const pendingInputs = new Map<string, AcademicReminderInput>();
const pendingResults = new Map<string, AcademicReminder>();

function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `academic-reminder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isReminderRequest(input: unknown): input is ReminderRequest {
  if (!input || typeof input !== "object") return false;
  const requestId = (input as Record<string, unknown>).requestId;
  return typeof requestId === "string" && requestId.length > 0 && requestId.length <= 120;
}

function validateInput(input: AcademicReminderInput) {
  const title = input.title.trim().replace(/\s+/g, " ").slice(0, 110);
  const date = input.date;
  const parsedDate = new Date(`${date}T12:00:00Z`);
  if (!title) throw new TypeError("Academic reminder title is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new TypeError("Academic reminder date is invalid");
  }
  return { title, date };
}

const registry = new SkillRegistry().register({
  id: ACADEMIC_REMINDER_SKILL_ID,
  name: "Local academic reminder",
  description: "Saves a reviewed academic reminder locally after explicit user approval.",
  version: "1",
  execute(input) {
    if (!isReminderRequest(input)) throw new TypeError("Invalid academic reminder request");
    const pending = pendingInputs.get(input.requestId);
    if (!pending) throw new Error("Academic reminder request expired");
    const reminder = saveAcademicReminder(validateInput(pending));
    pendingResults.set(input.requestId, reminder);

    // The reviewed title and date stay out of generic and persistent run history.
    return { requestId: input.requestId, saved: true };
  },
});

const history = new InMemoryRunHistoryStore();
const engine = new AutomationEngine(registry, history, { createId: createRequestId });

export async function saveReviewedAcademicReminder(input: AcademicReminderInput): Promise<AcademicReminder> {
  const normalized = validateInput(input);
  const requestId = createRequestId();
  pendingInputs.set(requestId, normalized);

  try {
    try {
      const run = await engine.run(
        {
          id: ACADEMIC_REMINDER_AUTOMATION_ID,
          name: "Save reviewed academic reminder",
          skillId: ACADEMIC_REMINDER_SKILL_ID,
          enabled: true,
          trigger: { type: "manual" },
          input: { requestId },
        },
        { source: "manual" },
      );

      persistAutomationRunBestEffort(run);

      if (run.status === "succeeded") {
        const reminder = pendingResults.get(requestId);
        if (reminder) return reminder;
      }
    } catch {
      // Fall through to the existing direct local save path.
    }

    return saveAcademicReminder(normalized);
  } finally {
    pendingInputs.delete(requestId);
    pendingResults.delete(requestId);
  }
}

export function listAcademicReminderAutomationRuns(): Promise<AutomationRun[]> {
  return history.list({ skillId: ACADEMIC_REMINDER_SKILL_ID });
}
