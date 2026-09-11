import assert from "node:assert/strict";
import test from "node:test";
import {
  AutomationEngine,
  InMemoryRunHistoryStore,
  SkillRegistry,
  type AutomationDefinition,
} from "../lib/navixa-core/index.ts";

const manualAutomation = (overrides: Partial<AutomationDefinition> = {}): AutomationDefinition => ({
  id: "daily-summary",
  name: "Daily summary",
  skillId: "summary.create",
  enabled: true,
  trigger: { type: "manual" },
  input: { text: "NAVIXA" },
  ...overrides,
});

const clock = (...values: string[]) => {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]);
};

test("skill registry registers, lists, and rejects duplicate ids", () => {
  const registry = new SkillRegistry();
  registry.register({ id: "summary.create", name: "Summary", execute: () => "ok" });

  assert.equal(registry.has("summary.create"), true);
  assert.equal(registry.get("summary.create")?.name, "Summary");
  assert.deepEqual(registry.list().map((skill) => skill.id), ["summary.create"]);
  assert.throws(
    () => registry.register({ id: "summary.create", name: "Duplicate", execute: () => "no" }),
    /already registered/,
  );
});

test("automation engine executes a skill and records a successful run", async () => {
  const registry = new SkillRegistry().register({
    id: "summary.create",
    name: "Summary",
    execute: (input, context) => ({ input, runId: context.runId, source: context.metadata?.source }),
  });
  const history = new InMemoryRunHistoryStore();
  const engine = new AutomationEngine(registry, history, {
    createId: () => "run-success",
    now: clock("2026-09-11T01:00:00.000Z", "2026-09-11T01:00:02.000Z"),
  });

  const run = await engine.run(manualAutomation(), { source: "test" });

  assert.equal(run.status, "succeeded");
  assert.equal(run.id, "run-success");
  assert.equal(run.startedAt, "2026-09-11T01:00:00.000Z");
  assert.equal(run.completedAt, "2026-09-11T01:00:02.000Z");
  assert.deepEqual(run.output, {
    input: { text: "NAVIXA" },
    runId: "run-success",
    source: "test",
  });
  assert.deepEqual(await history.list({ status: "succeeded" }), [run]);
});

test("automation engine records skill failures without leaking a stack trace", async () => {
  const registry = new SkillRegistry().register({
    id: "summary.create",
    name: "Summary",
    execute: () => {
      throw new TypeError("provider unavailable");
    },
  });
  const history = new InMemoryRunHistoryStore();
  const engine = new AutomationEngine(registry, history, {
    createId: () => "run-failed",
    now: clock("2026-09-11T02:00:00.000Z", "2026-09-11T02:00:01.000Z"),
  });

  const run = await engine.run(manualAutomation());

  assert.equal(run.status, "failed");
  assert.deepEqual(run.error, { name: "TypeError", message: "provider unavailable" });
  assert.equal("stack" in (run.error ?? {}), false);
  assert.equal((await history.get("run-failed"))?.status, "failed");
});

test("disabled automations are skipped and do not execute their skill", async () => {
  let executions = 0;
  const registry = new SkillRegistry().register({
    id: "summary.create",
    name: "Summary",
    execute: () => {
      executions += 1;
      return "unexpected";
    },
  });
  const history = new InMemoryRunHistoryStore();
  const engine = new AutomationEngine(registry, history, {
    createId: () => "run-skipped",
    now: clock("2026-09-11T03:00:00.000Z", "2026-09-11T03:00:00.000Z"),
  });

  const run = await engine.run(manualAutomation({ enabled: false }));

  assert.equal(run.status, "skipped");
  assert.equal(executions, 0);
  assert.equal((await history.get("run-skipped"))?.status, "skipped");
});

test("missing skills fail safely and remain visible in run history", async () => {
  const history = new InMemoryRunHistoryStore();
  const engine = new AutomationEngine(new SkillRegistry(), history, {
    createId: () => "run-missing",
    now: clock("2026-09-11T04:00:00.000Z", "2026-09-11T04:00:01.000Z"),
  });

  const run = await engine.run(manualAutomation());

  assert.equal(run.status, "failed");
  assert.equal(run.error?.name, "SkillNotFoundError");
  assert.match(run.error?.message ?? "", /summary\.create/);
  assert.deepEqual(await history.list({ automationId: "daily-summary", limit: 1 }), [run]);
});
