import type {
  AutomationRun,
  AutomationRunUpdate,
  RunHistoryFilter,
} from "./types.ts";

export interface RunHistoryStore {
  create(run: AutomationRun): Promise<void>;
  update(id: string, update: AutomationRunUpdate): Promise<AutomationRun>;
  get(id: string): Promise<AutomationRun | undefined>;
  list(filter?: RunHistoryFilter): Promise<AutomationRun[]>;
}

const cloneRun = (run: AutomationRun): AutomationRun => ({
  ...run,
  trigger: { ...run.trigger },
  metadata: run.metadata ? { ...run.metadata } : undefined,
  error: run.error ? { ...run.error } : undefined,
});

export class InMemoryRunHistoryStore implements RunHistoryStore {
  private readonly runs = new Map<string, AutomationRun>();

  async create(run: AutomationRun): Promise<void> {
    if (this.runs.has(run.id)) throw new Error(`Run already exists: ${run.id}`);
    this.runs.set(run.id, cloneRun(run));
  }

  async update(id: string, update: AutomationRunUpdate): Promise<AutomationRun> {
    const current = this.runs.get(id);
    if (!current) throw new Error(`Run not found: ${id}`);

    const next = cloneRun({ ...current, ...update });
    this.runs.set(id, next);
    return cloneRun(next);
  }

  async get(id: string): Promise<AutomationRun | undefined> {
    const run = this.runs.get(id);
    return run ? cloneRun(run) : undefined;
  }

  async list(filter: RunHistoryFilter = {}): Promise<AutomationRun[]> {
    const limit = filter.limit == null ? Number.POSITIVE_INFINITY : Math.max(0, filter.limit);

    return [...this.runs.values()]
      .filter((run) => !filter.automationId || run.automationId === filter.automationId)
      .filter((run) => !filter.skillId || run.skillId === filter.skillId)
      .filter((run) => !filter.status || run.status === filter.status)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit)
      .map(cloneRun);
  }
}
