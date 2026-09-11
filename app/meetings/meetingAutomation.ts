import {
  AutomationEngine,
  InMemoryRunHistoryStore,
  SkillRegistry,
  type AutomationRun,
} from "../../lib/navixa-core/index.ts";
import { buildLocalSummary } from "./meetingSummary";

const MEETING_SUMMARY_SKILL_ID = "meeting.summary.local";
const MEETING_SUMMARY_AUTOMATION_ID = "meeting.summary.after-transcription";

type MeetingLocalSummary = ReturnType<typeof buildLocalSummary>;
type SummaryRequest = { requestId: string };

type MeetingSummaryMetadata = Readonly<{
  sessionId?: string;
  partId?: string;
  source?: "transcription" | "manual" | "test";
}>;

const pendingTranscripts = new Map<string, string>();
const pendingSummaries = new Map<string, MeetingLocalSummary>();

function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `meeting-summary-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isSummaryRequest(input: unknown): input is SummaryRequest {
  if (!input || typeof input !== "object") return false;
  const requestId = (input as Record<string, unknown>).requestId;
  return typeof requestId === "string" && requestId.length > 0 && requestId.length <= 120;
}

const registry = new SkillRegistry().register({
  id: MEETING_SUMMARY_SKILL_ID,
  name: "Local meeting summary",
  description: "Builds the existing NAVIXA meeting summary locally after transcription.",
  version: "1",
  execute(input) {
    if (!isSummaryRequest(input)) throw new TypeError("Invalid meeting summary request");
    const transcript = pendingTranscripts.get(input.requestId);
    if (typeof transcript !== "string") throw new Error("Meeting summary request expired");

    const summary = buildLocalSummary(transcript);
    pendingSummaries.set(input.requestId, summary);

    // Keep transcript and generated summary out of generic run history.
    return { requestId: input.requestId, generated: true };
  },
});

const history = new InMemoryRunHistoryStore();
const engine = new AutomationEngine(registry, history, { createId: createRequestId });

export async function summarizeMeetingTranscript(
  transcript: string,
  metadata: MeetingSummaryMetadata = {},
): Promise<MeetingLocalSummary> {
  const requestId = createRequestId();
  pendingTranscripts.set(requestId, transcript);

  try {
    const run = await engine.run(
      {
        id: MEETING_SUMMARY_AUTOMATION_ID,
        name: "Summarize completed meeting transcript",
        skillId: MEETING_SUMMARY_SKILL_ID,
        enabled: true,
        trigger: { type: "event", event: "meeting.transcription.completed" },
        input: { requestId },
      },
      metadata,
    );

    if (run.status !== "succeeded") {
      throw new Error(run.error?.message || "Meeting summary automation failed");
    }

    const summary = pendingSummaries.get(requestId);
    if (!summary) throw new Error("Meeting summary automation returned no result");
    return summary;
  } finally {
    pendingTranscripts.delete(requestId);
    pendingSummaries.delete(requestId);
  }
}

export function listMeetingSummaryAutomationRuns(): Promise<AutomationRun[]> {
  return history.list({ skillId: MEETING_SUMMARY_SKILL_ID });
}
