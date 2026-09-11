import type { AutomationRun } from "../lib/navixa-core/index.ts";

const PERSISTENT_RUN_HISTORY_URL = "/api/automation-runs";

type PersistentRunFilter = Readonly<{
  automationId?: string;
  skillId?: string;
  status?: AutomationRun["status"];
  limit?: number;
}>;

function safeMetadataRef(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,120}$/.test(value) ? value : "";
}

function safeSource(value: unknown): "" | "transcription" | "manual" | "test" {
  return value === "transcription" || value === "manual" || value === "test" ? value : "";
}

function triggerValue(run: AutomationRun) {
  if (run.trigger.type === "event") return run.trigger.event;
  if (run.trigger.type === "schedule") return run.trigger.schedule;
  return "";
}

export function persistentRunPayload(run: AutomationRun) {
  const metadata = run.metadata || {};
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
    source: safeSource(metadata.source),
  };
}

export function persistAutomationRunBestEffort(run: AutomationRun) {
  if (typeof globalThis.fetch !== "function") return;
  try {
    void globalThis.fetch(PERSISTENT_RUN_HISTORY_URL, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(persistentRunPayload(run)),
    }).catch(() => undefined);
  } catch {
    // Persistent history is observational only; it must never break local automation.
  }
}

export async function listPersistentAutomationRuns(filter: PersistentRunFilter = {}): Promise<AutomationRun[]> {
  if (typeof window === "undefined" || typeof globalThis.fetch !== "function") return [];
  try {
    const params = new URLSearchParams();
    if (filter.automationId) params.set("automationId", filter.automationId);
    if (filter.skillId) params.set("skillId", filter.skillId);
    if (filter.status) params.set("status", filter.status);
    params.set("limit", String(Math.min(100, Math.max(1, filter.limit ?? 50))));
    const response = await globalThis.fetch(`${PERSISTENT_RUN_HISTORY_URL}?${params.toString()}`, {
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
