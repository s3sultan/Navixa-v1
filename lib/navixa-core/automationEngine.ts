import type { RunHistoryStore } from "./runHistory.ts";
import type { SkillRegistry } from "./skills.ts";
import type {
  AutomationDefinition,
  AutomationRun,
  AutomationRunError,
} from "./types.ts";

export interface AutomationEngineOptions {
  now?: () => Date;
  createId?: () => string;
}

const normalizeError = (error: unknown): AutomationRunError => {
  if (error instanceof Error) {
    return { name: error.name || "Error", message: error.message || "Automation failed" };
  }

  return { name: "Error", message: typeof error === "string" ? error : "Automation failed" };
};

export class AutomationEngine {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly skills: SkillRegistry,
    private readonly history: RunHistoryStore,
    options: AutomationEngineOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => globalThis.crypto.randomUUID());
  }

  async run(
    automation: AutomationDefinition,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<AutomationRun> {
    const startedAt = this.now().toISOString();
    const baseRun: AutomationRun = {
      id: this.createId(),
      automationId: automation.id,
      automationName: automation.name,
      skillId: automation.skillId,
      trigger: { ...automation.trigger },
      status: "queued",
      startedAt,
      input: automation.input,
      metadata: metadata ? { ...metadata } : undefined,
    };

    if (!automation.enabled) {
      const skipped: AutomationRun = {
        ...baseRun,
        status: "skipped",
        completedAt: this.now().toISOString(),
      };
      await this.history.create(skipped);
      return skipped;
    }

    await this.history.create(baseRun);
    await this.history.update(baseRun.id, { status: "running" });

    const skill = this.skills.get(automation.skillId);
    if (!skill) {
      return this.history.update(baseRun.id, {
        status: "failed",
        completedAt: this.now().toISOString(),
        error: { name: "SkillNotFoundError", message: `Skill not found: ${automation.skillId}` },
      });
    }

    try {
      const output = await skill.execute(automation.input, {
        automationId: automation.id,
        runId: baseRun.id,
        trigger: { ...automation.trigger },
        startedAt,
        metadata: metadata ? { ...metadata } : undefined,
      });

      return this.history.update(baseRun.id, {
        status: "succeeded",
        completedAt: this.now().toISOString(),
        output,
      });
    } catch (error) {
      return this.history.update(baseRun.id, {
        status: "failed",
        completedAt: this.now().toISOString(),
        error: normalizeError(error),
      });
    }
  }
}
