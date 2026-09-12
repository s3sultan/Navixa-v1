import assert from "node:assert/strict";
import test from "node:test";

import { REQUIRED_NAVIXA_WORKFLOWS, assessWorkflowRuns } from "../scripts/dev-guardian/ci-evidence.mjs";
import { aggregateEvidence } from "../scripts/dev-guardian/evidence-aggregator.mjs";

function run({ id, name, sha = "head123", status = "completed", conclusion = "success", runNumber = 1, attempt = 1 } = {}) {
  return {
    id,
    name,
    head_sha: sha,
    event: "pull_request",
    status,
    conclusion,
    run_number: runNumber,
    run_attempt: attempt,
    html_url: `https://example.invalid/${id}`,
  };
}

function successfulRuns(sha = "head123") {
  return REQUIRED_NAVIXA_WORKFLOWS.map((name, index) => run({ id: index + 1, name, sha, runNumber: 10 + index }));
}

test("CI evidence passes only when all required workflows succeed on the exact head", () => {
  const evidence = assessWorkflowRuns({ headSha: "head123", runs: successfulRuns() });
  assert.equal(evidence.valid, true);
  assert.deepEqual(evidence.reasons, []);
  assert.equal(evidence.checks.length, 3);
  assert.ok(evidence.checks.every((check) => check.passed));
});

test("CI evidence ignores a green run from another head", () => {
  const runs = successfulRuns("other-head");
  const evidence = assessWorkflowRuns({ headSha: "head123", runs });
  assert.equal(evidence.valid, false);
  assert.equal(evidence.checks.every((check) => check.status === "missing"), true);
});

test("newest same-head run wins so an older success cannot hide a newer cancellation", () => {
  const runs = successfulRuns();
  runs.push(run({
    id: 99,
    name: "Verify NAVIXA Pull Request",
    sha: "head123",
    status: "completed",
    conclusion: "cancelled",
    runNumber: 999,
  }));
  const evidence = assessWorkflowRuns({ headSha: "head123", runs });
  const check = evidence.checks.find((item) => item.name === "Verify NAVIXA Pull Request");
  assert.equal(evidence.valid, false);
  assert.equal(check.status, "cancelled");
  assert.equal(check.runNumber, 999);
});

test("pending workflow blocks CI evidence", () => {
  const runs = successfulRuns();
  runs.push(run({
    id: 100,
    name: "NAVIXA Pre-Launch Gate",
    sha: "head123",
    status: "in_progress",
    conclusion: null,
    runNumber: 1000,
  }));
  const evidence = assessWorkflowRuns({ headSha: "head123", runs });
  assert.equal(evidence.valid, false);
  assert.ok(evidence.reasons.includes("ci:NAVIXA Pre-Launch Gate:in_progress"));
});

test("Evidence Aggregator consumes exact-head CI evidence", () => {
  const ciEvidence = assessWorkflowRuns({ headSha: "head123", runs: successfulRuns() });
  const evidence = aggregateEvidence({
    plan: { review: { assignments: [] } },
    checks: [{ name: "guardian-plan", status: "success", required: true }],
    reviews: [],
    executionGuard: { allowed: true, reasons: [] },
    ciEvidence,
    expectedHeadSha: "head123",
    requireCiEvidence: true,
  });
  assert.equal(evidence.verdict, "PASS");
  assert.equal(evidence.mergeAllowed, true);
  assert.equal(evidence.ciHeadSha, "head123");
  assert.ok(evidence.checks.some((check) => check.name === "ci:NAVIXA Pre-Launch Gate"));
});

test("Evidence Aggregator blocks missing or mismatched CI evidence", () => {
  const missing = aggregateEvidence({
    plan: { review: { assignments: [] } },
    requireCiEvidence: true,
  });
  assert.equal(missing.mergeAllowed, false);
  assert.ok(missing.reasons.includes("missing-ci-evidence"));

  const ciEvidence = assessWorkflowRuns({ headSha: "head123", runs: successfulRuns() });
  const mismatched = aggregateEvidence({
    plan: { review: { assignments: [] } },
    ciEvidence,
    expectedHeadSha: "different-head",
    requireCiEvidence: true,
  });
  assert.equal(mismatched.mergeAllowed, false);
  assert.ok(mismatched.reasons.includes("ci-head-mismatch:head123:different-head"));
});
