export type AutomationTrigger =
  | { type: "manual" }
  | { type: "schedule"; schedule: string }
  | { type: "event"; event: string };

export type AutomationRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled";

export interface AutomationDefinition {
  id: string;
  name: string;
  skillId: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  input?: unknown;
}

export interface SkillContext {
  automationId: string;
  runId: string;
  trigger: AutomationTrigger;
  startedAt: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description?: string;
  version?: string;
  execute(input: unknown, context: SkillContext): Promise<unknown> | unknown;
}

export interface AutomationRunError {
  name: string;
  message: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  skillId: string;
  trigger: AutomationTrigger;
  status: AutomationRunStatus;
  startedAt: string;
  completedAt?: string;
  input?: unknown;
  output?: unknown;
  error?: AutomationRunError;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface RunHistoryFilter {
  automationId?: string;
  skillId?: string;
  status?: AutomationRunStatus;
  limit?: number;
}

export type AutomationRunUpdate = Pick<AutomationRun, "status"> &
  Partial<Pick<AutomationRun, "completedAt" | "output" | "error">>;
