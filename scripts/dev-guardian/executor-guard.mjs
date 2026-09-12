#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { evaluateScope, guardAgentRun, DEV_GUARDIAN_DEFAULTS } from "./guards.mjs";
import { readExecutionEvents, summarizeLedgerUsage } from "./event-ledger.mjs";

export function validateExecutorMutation({
  plan,
  executor,
  baseCommit,
  changedFiles = [],
  events = [],
  usage,
} = {}) {
  const reasons = [];
  const expectedExecutor = plan?.route?.primary;
  const expectedBase = plan?.contract?.baseCommit;
  const normalizedExecutor = String(executor || "").trim();
  const normalizedBase = String(baseCommit || "").trim();

  if (!plan?.contract?.validation?.valid) reasons.push("invalid-task-contract");
  if (!normalizedExecutor) reasons.push("missing-executor");
  else if (expectedExecutor && normalizedExecutor !== expectedExecutor) reasons.push(`executor-mismatch:${normalizedExecutor}:${expectedExecutor}`);
  if (!normalizedBase) reasons.push("missing-base-commit");
  else if (expectedBase && normalizedBase !== expectedBase) reasons.push(`base-commit-mismatch:${normalizedBase}:${expectedBase}`);

  const forbidden = [...DEV_GUARDIAN_DEFAULTS.forbiddenPaths, ...(plan?.contract?.forbiddenScope || [])];
  const scope = evaluateScope({
    files: changedFiles,
    allowed: plan?.contract?.allowedScope || [],
    forbidden,
  });
  for (const item of scope.blocked) reasons.push(`scope:${item.reason}:${item.file}`);

  const effectiveUsage = usage || summarizeLedgerUsage(events);
  const runtimeGuard = guardAgentRun({
    files: changedFiles,
    allowed: plan?.contract?.allowedScope || [],
    forbidden,
    limits: plan?.guardPolicy || {},
    usage: effectiveUsage,
    events,
  });
  for (const reason of runtimeGuard.reasons) reasons.push(reason);

  return {
    schemaVersion: 1,
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)],
    expectedExecutor: expectedExecutor || null,
    expectedBase: expectedBase || null,
    scope,
    runtimeGuard,
  };
}

async function main() {
  const planPath = process.env.NAVIXA_PLAN_FILE;
  const changedFilesPath = process.env.NAVIXA_CHANGED_FILES_FILE;
  const executor = process.env.NAVIXA_EXECUTOR;
  const baseCommit = process.env.NAVIXA_CURRENT_BASE_COMMIT;
  if (!planPath || !changedFilesPath) throw new Error("NAVIXA_PLAN_FILE and NAVIXA_CHANGED_FILES_FILE are required.");

  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const changedFiles = (await readFile(changedFilesPath, "utf8")).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const events = await readExecutionEvents(process.env.NAVIXA_EVENT_LOG);
  const decision = validateExecutorMutation({ plan, executor, baseCommit, changedFiles, events });
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  if (!decision.allowed) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`NAVIXA executor guard failed: ${error.message}`);
    process.exitCode = 1;
  });
}
