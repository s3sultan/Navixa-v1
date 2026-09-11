import {
  AutomationEngine,
  InMemoryRunHistoryStore,
  SkillRegistry,
  type AutomationRun,
} from "../../lib/navixa-core/index.ts";
import { buildLocalSummary } from "./meetingSummary.ts";

const MEETING_SUMMARY_SKILL_ID = "meeting.summary.local";
const MEETING_SUMMARY_AUTOMATION_ID = "meeting.summary.after-transcription";
const PERSISTENT_RUN_HISTORY_URL = "/api/automation-runs";

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

function safeMetadataRef(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,120}$/.test(value) ? value : "";
}

function triggerValue(run: AutomationRun) {
  if (run.trigger.type === "event") return run.trigger.event;
  if (run.trigger.type === "schedule") return run.trigger.schedule;
  return "";
}

function persistencePayload(run: AutomationRun) {
  const metadata = run.metadata || {};
  const source = metadata.source === "transcription" || metadata.source === "manual" || metadata.source === "test"
    ? metadata.source
    : "";

  return {
    id: run.id,
    automationId: run.automationId,
    automationName: run.automationName,
    skillId: run.skillId,
    triggerType: run.trigger.type,
    triggerValue: triggerValue(run),
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt || "",
    sessionRef: safeMetadataRef(metadata.sessionId),
    partRef: safeMetadataRef(metadata.partId),
    source,
  };
}

function persistRunBestEffort(run: AutomationRun) {
  if (typeof globalThis.fetch !== "function") return;
  try {
    void globalThis.fetch(PERSISTENT_RUN_HISTORY_URL, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(persistencePayload(run)),
    }).catch(() => undefined);
  } catch {
    // Persistent history is observational only; it must never break local automation.
  }
}

async function listPersistentRuns(): Promise<AutomationRun[]> {
  if (typeof window === "undefined" || typeof globalThis.fetch !== "function") return [];
  try {
    const response = await globalThis.fetch(`${PERSISTENT_RUN_HISTORY_URL}?skillId=${encodeURIComponent(MEETING_SUMMARY_SKILL_ID)}&limit=50`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return [];
    const body = await response.json() as { runs?: AutomationRun[] };
    return Array.isArray(body.runs) ? body.runs : [];
  } catch {
    return [];
  }
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

    persistRunBestEffort(run);

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

export async function listMeetingSummaryAutomationRuns(): Promise<AutomationRun[]> {
  const [localRuns, persistentRuns] = await Promise.all([
    history.list({ skillId: MEETING_SUMMARY_SKILL_ID }),
    listPersistentRuns(),
  ]);
  const merged = new Map<string, AutomationRun>();
  for (const run of persistentRuns) merged.set(run.id, run);
  for (const run of localRuns) merged.set(run.id, run);
  return [...merged.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
