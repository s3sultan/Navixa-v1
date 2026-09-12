import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { appendExecutionEvent, evaluateLiveExecution, readExecutionEvents } from "../scripts/dev-guardian/event-ledger.mjs";
import { validateExecutorMutation } from "../scripts/dev-guardian/executor-guard.mjs";
import { aggregateEvidence, parseReviewVerdict } from "../scripts/dev-guardian/evidence-aggregator.mjs";

function planFixture() {
  return {
    contract: {
      validation: { valid: true, errors: [] },
      baseCommit: "abc123",
      allowedScope: ["app/auth/**", "tests/auth/**"],
      forbiddenScope: ["app/auth/private/**"],
      contextPaths: ["app/auth/service.ts"],
    },
    route: { primary: "Codex" },
    guardPolicy: { maxSteps: 10, maxTokens: 5000, maxWallMs: 60_000 },
    review: {
      assignments: [
        { role: "ai-tester", agent: "Gemini API / AI Studio", required: true },
        { role: "independent-reviewer", agent: "Manus", required: true },
      ],
    },
  };
}

test("event ledger stores fingerprints instead of raw review or error content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "navixa-ledger-"));
  const filePath = path.join(root, "events.jsonl");
  try {
    await appendExecutionEvent(filePath, {
      role: "ai-tester",
      agent: "Gemini API / AI Studio",
      action: "review",
      result: "TOP_SECRET_REVIEW_TEXT",
      error: "TOP_SECRET_ERROR_TEXT",
      usageDelta: { tokens: 42 },
    });
    const raw = await readFile(filePath, "utf8");
    assert.doesNotMatch(raw, /TOP_SECRET_REVIEW_TEXT/);
    assert.doesNotMatch(raw, /TOP_SECRET_ERROR_TEXT/);
    const events = await readExecutionEvents(filePath);
    assert.equal(events.length, 1);
    assert.equal(events[0].resultSignature.length, 24);
    assert.equal(events[0].errorSignature.length, 24);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("live execution guard detects repeated failures from the shared ledger", () => {
  const plan = planFixture();
  const events = [1, 2, 3].map((index) => ({
    at: new Date(1_000 + index).toISOString(),
    action: `attempt-${index}`,
    target: "app/auth/service.ts",
    ok: false,
    status: "failed",
    errorSignature: "same-error-fingerprint",
    usageDelta: { steps: 1, tokens: 10, costUsd: 0 },
  }));
  const decision = evaluateLiveExecution({ plan, events, files: ["app/auth/service.ts"], now: 2_000 });
  assert.equal(decision.allowed, false);
  assert.equal(decision.stuck.stuck, true);
  assert.ok(["repeated-error", "consecutive-failures"].includes(decision.stuck.reason));
});

test("executor guard rejects wrong executor, stale base, and out-of-scope mutation", () => {
  const decision = validateExecutorMutation({
    plan: planFixture(),
    executor: "Claude Code",
    baseCommit: "deadbeef",
    changedFiles: ["app/auth/service.ts", "app/billing/charge.ts"],
    events: [],
    usage: { steps: 1, tokens: 10, costUsd: 0, startedAt: 1_000, now: 2_000 },
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.some((item) => item.startsWith("executor-mismatch:")));
  assert.ok(decision.reasons.some((item) => item.startsWith("base-commit-mismatch:")));
  assert.ok(decision.reasons.includes("scope:outside-allowed-scope:app/billing/charge.ts"));
});

test("executor guard allows the assigned executor inside contract scope", () => {
  const decision = validateExecutorMutation({
    plan: planFixture(),
    executor: "Codex",
    baseCommit: "abc123",
    changedFiles: ["app/auth/service.ts", "tests/auth/session.test.ts"],
    events: [],
    usage: { steps: 2, tokens: 100, costUsd: 0, startedAt: 1_000, now: 2_000 },
  });
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.reasons, []);
});

test("evidence passes with AI Tester success and CLEAR independent review", () => {
  const evidence = aggregateEvidence({
    plan: planFixture(),
    checks: [
      { name: "guardian-plan", status: "success", required: true },
      { name: "ai-tester-step", status: "success", required: true },
      { name: "independent-reviewer-step", status: "success", required: true },
    ],
    reviews: [
      { role: "ai-tester", agent: "Gemini API / AI Studio", status: "success", verdict: null },
      { role: "independent-reviewer", agent: "Manus", status: "success", verdict: "CLEAR" },
    ],
    executionGuard: { allowed: true, reasons: [] },
  });
  assert.equal(evidence.verdict, "PASS");
  assert.equal(evidence.mergeAllowed, true);
});

test("evidence allows MINOR but blocks MAJOR or missing required reviewer", () => {
  const minor = aggregateEvidence({
    plan: planFixture(),
    checks: [{ name: "all", status: "success", required: true }],
    reviews: [
      { role: "ai-tester", agent: "Gemini API / AI Studio", status: "success" },
      { role: "independent-reviewer", agent: "Manus", status: "success", verdict: "MINOR" },
    ],
  });
  assert.equal(minor.verdict, "PASS_WITH_MINOR");
  assert.equal(minor.mergeAllowed, true);

  const major = aggregateEvidence({
    plan: planFixture(),
    checks: [{ name: "all", status: "success", required: true }],
    reviews: [
      { role: "ai-tester", agent: "Gemini API / AI Studio", status: "success" },
      { role: "independent-reviewer", agent: "Manus", status: "success", verdict: "MAJOR" },
    ],
  });
  assert.equal(major.verdict, "BLOCK");
  assert.equal(major.mergeAllowed, false);
  assert.ok(major.reasons.some((item) => item.startsWith("review-major:")));

  const missing = aggregateEvidence({
    plan: planFixture(),
    checks: [{ name: "all", status: "success", required: true }],
    reviews: [{ role: "ai-tester", agent: "Gemini API / AI Studio", status: "success" }],
  });
  assert.equal(missing.verdict, "BLOCK");
  assert.ok(missing.reasons.includes("missing-review:independent-reviewer"));
});

test("review verdict parser uses the final explicit verdict", () => {
  assert.equal(parseReviewVerdict("Possible MINOR issue fixed. Final verdict: CLEAR"), "CLEAR");
  assert.equal(parseReviewVerdict("No explicit decision"), null);
});
