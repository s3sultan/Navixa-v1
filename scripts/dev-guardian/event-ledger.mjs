#!/usr/bin/env node

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { guardAgentRun, DEV_GUARDIAN_DEFAULTS } from "./guards.mjs";

function fingerprint(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function sanitizeEvent(event = {}) {
  return {
    schemaVersion: 1,
    at: event.at || new Date().toISOString(),
    role: String(event.role || "unknown").slice(0, 80),
    agent: String(event.agent || "unknown").slice(0, 120),
    action: String(event.action || "event").slice(0, 120),
    target: String(event.target || "").replaceAll("\\", "/").slice(0, 300),
    ok: event.ok !== false,
    status: String(event.status || (event.ok === false ? "failed" : "completed")).slice(0, 40),
    resultSignature: event.resultSignature || fingerprint(event.result),
    errorSignature: event.errorSignature || fingerprint(event.error),
    progressHash: event.progressHash ? String(event.progressHash).slice(0, 128) : "",
    usageDelta: {
      tokens: numberOrZero(event.usageDelta?.tokens),
      costUsd: numberOrZero(event.usageDelta?.costUsd),
      steps: numberOrZero(event.usageDelta?.steps) || 1,
    },
  };
}

export async function readExecutionEvents(filePath, { maxEvents = 200 } = {}) {
  if (!filePath) return [];
  try {
    const content = await readFile(filePath, "utf8");
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .slice(-maxEvents);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function appendExecutionEvent(filePath, event) {
  if (!filePath) return sanitizeEvent(event);
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  const sanitized = sanitizeEvent(event);
  await appendFile(filePath, `${JSON.stringify(sanitized)}\n`, "utf8");
  return sanitized;
}

export function summarizeLedgerUsage(events = [], { now = Date.now() } = {}) {
  const firstAt = events.map((event) => Date.parse(event?.at)).find(Number.isFinite);
  return {
    startedAt: Number.isFinite(firstAt) ? firstAt : now,
    now,
    steps: events.reduce((sum, event) => sum + numberOrZero(event?.usageDelta?.steps), 0),
    tokens: events.reduce((sum, event) => sum + numberOrZero(event?.usageDelta?.tokens), 0),
    costUsd: events.reduce((sum, event) => sum + numberOrZero(event?.usageDelta?.costUsd), 0),
  };
}

export function evaluateLiveExecution({ plan, events = [], files = [], pendingUsageDelta = {}, now = Date.now() } = {}) {
  const synthetic = pendingUsageDelta && Object.values(pendingUsageDelta).some((value) => Number(value) > 0)
    ? [...events, sanitizeEvent({ action: "pending-step", usageDelta: pendingUsageDelta })]
    : events;
  const usage = summarizeLedgerUsage(synthetic, { now });
  return guardAgentRun({
    files,
    allowed: plan?.contract?.allowedScope || [],
    forbidden: [...DEV_GUARDIAN_DEFAULTS.forbiddenPaths, ...(plan?.contract?.forbiddenScope || [])],
    limits: plan?.guardPolicy || {},
    usage,
    events: synthetic,
  });
}

export async function recordGuardedExecutionEvent({ filePath, plan, event, files = [] } = {}) {
  const existing = await readExecutionEvents(filePath);
  const candidate = sanitizeEvent(event);
  const guard = evaluateLiveExecution({ plan, events: [...existing, candidate], files });
  const recorded = await appendExecutionEvent(filePath, {
    ...candidate,
    resultSignature: candidate.resultSignature,
    errorSignature: candidate.errorSignature,
  });
  return { guard, event: recorded, events: [...existing, recorded] };
}
