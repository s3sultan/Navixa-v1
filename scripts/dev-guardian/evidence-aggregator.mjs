#!/usr/bin/env node

import { appendFile, readFile, writeFile } from "node:fs/promises";
import { evaluateLiveExecution, readExecutionEvents } from "./event-ledger.mjs";

const REVIEW_ORDER = Object.freeze({ CLEAR: 0, MINOR: 1, MAJOR: 2, BLOCKER: 3 });

export function parseReviewVerdict(text = "") {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();
  for (const line of lines) {
    const exact = line.match(/^(CLEAR|MINOR|MAJOR|BLOCKER)[.!]?$/i);
    if (exact) return exact[1].toUpperCase();
    const explicit = line.match(/^(?:FINAL\s+)?VERDICT\s*:\s*(CLEAR|MINOR|MAJOR|BLOCKER)[.!]?$/i);
    if (explicit) return explicit[1].toUpperCase();
  }
  return null;
}

function normalizeCheck(check = {}) {
  const status = String(check.status || "unknown").toLowerCase();
  return {
    name: String(check.name || "unnamed-check"),
    status,
    required: check.required !== false,
    passed: status === "success" || status === "passed" || status === "clear",
  };
}

function normalizeReview(review = {}) {
  const verdict = review.verdict || parseReviewVerdict(review.text);
  return {
    role: String(review.role || "unknown"),
    agent: String(review.agent || "unknown"),
    status: String(review.status || "unknown").toLowerCase(),
    required: review.required !== false,
    verdict,
    severity: verdict && Object.hasOwn(REVIEW_ORDER, verdict) ? REVIEW_ORDER[verdict] : null,
  };
}

function roleRequiresVerdict(role) {
  return role === "independent-reviewer" || role === "security-reviewer";
}

function ciChecks(ciEvidence) {
  if (!ciEvidence || !Array.isArray(ciEvidence.checks)) return [];
  return ciEvidence.checks.map((check) => ({
    name: `ci:${String(check.name || "unknown")}`,
    status: check.status || "unknown",
    required: check.required !== false,
  }));
}

export function aggregateEvidence({
  plan,
  checks = [],
  reviews = [],
  executionGuard = { allowed: true },
  ciEvidence = null,
  expectedHeadSha = null,
  requireCiEvidence = false,
} = {}) {
  const normalizedChecks = [...checks, ...ciChecks(ciEvidence)].map(normalizeCheck);
  const normalizedReviews = reviews.map(normalizeReview);
  const requiredAssignments = (plan?.review?.assignments || [])
    .filter((item) => item.required)
    .map((item) => ({ role: String(item.role), agent: String(item.agent) }));
  const reasons = [];

  if (requireCiEvidence && !ciEvidence) reasons.push("missing-ci-evidence");
  if (ciEvidence && expectedHeadSha && String(ciEvidence.headSha || "") !== String(expectedHeadSha)) {
    reasons.push(`ci-head-mismatch:${ciEvidence.headSha || "missing"}:${expectedHeadSha}`);
  }

  for (const check of normalizedChecks) {
    if (check.required && !check.passed) reasons.push(`check-failed:${check.name}:${check.status}`);
  }

  for (const assignment of requiredAssignments) {
    const evidence = normalizedReviews.find(
      (review) => review.role === assignment.role && review.agent === assignment.agent,
    );
    if (!evidence) {
      reasons.push(`missing-review:${assignment.role}:${assignment.agent}`);
      continue;
    }
    if (evidence.status !== "success") {
      reasons.push(`review-failed:${assignment.role}:${assignment.agent}:${evidence.status}`);
    }
    if (roleRequiresVerdict(assignment.role) && !evidence.verdict) {
      reasons.push(`missing-verdict:${assignment.role}:${assignment.agent}`);
    }
  }

  for (const review of normalizedReviews) {
    if (review.severity === REVIEW_ORDER.MAJOR) reasons.push(`review-major:${review.role}:${review.agent}`);
    if (review.severity === REVIEW_ORDER.BLOCKER) reasons.push(`review-blocker:${review.role}:${review.agent}`);
  }

  if (executionGuard?.allowed === false) {
    for (const reason of executionGuard.reasons || ["execution-guard-blocked"]) reasons.push(`guard:${reason}`);
  }

  const hasMinor = normalizedReviews.some((review) => review.severity === REVIEW_ORDER.MINOR);
  const blocked = reasons.length > 0;
  return {
    schemaVersion: 1,
    verdict: blocked ? "BLOCK" : hasMinor ? "PASS_WITH_MINOR" : "PASS",
    mergeAllowed: !blocked,
    reasons: [...new Set(reasons)],
    checks: normalizedChecks,
    reviews: normalizedReviews,
    requiredRoles: requiredAssignments.map((item) => item.role),
    requiredReviewers: requiredAssignments,
    ciHeadSha: ciEvidence?.headSha || null,
  };
}

export function formatEvidenceSummary(evidence) {
  const checks = evidence.checks.map((item) => `- ${item.name}: ${item.status}${item.required ? " (required)" : ""}`).join("\n") || "- none";
  const reviews = evidence.reviews.map((item) => `- ${item.role} / ${item.agent}: ${item.status}, verdict ${item.verdict || "n/a"}`).join("\n") || "- none";
  const reasons = evidence.reasons.map((item) => `- ${item}`).join("\n") || "- none";
  return `## NAVIXA Dev Guardian evidence\n\n- Verdict: **${evidence.verdict}**\n- Merge allowed by Dev Guardian evidence: **${evidence.mergeAllowed ? "yes" : "no"}**\n- CI head: ${evidence.ciHeadSha ? `\`${evidence.ciHeadSha}\`` : "not supplied"}\n\n### Checks\n${checks}\n\n### Reviews\n${reviews}\n\n### Blocking reasons\n${reasons}`;
}

async function readOptionalJson(filePath) {
  if (!filePath) return null;
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function main() {
  const planPath = process.env.NAVIXA_PLAN_FILE;
  if (!planPath) throw new Error("NAVIXA_PLAN_FILE is required.");
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const aiTester = await readOptionalJson(process.env.NAVIXA_AI_TESTER_RESULT);
  const reviewer = await readOptionalJson(process.env.NAVIXA_REVIEWER_RESULT);
  const ciEvidence = await readOptionalJson(process.env.NAVIXA_CI_EVIDENCE_FILE);
  const reviews = [aiTester, reviewer].filter(Boolean);
  const assignmentMap = new Map((plan?.review?.assignments || []).map((item) => [item.role, item]));
  const checks = [
    { name: "guardian-plan", status: process.env.NAVIXA_PLAN_STEP_STATUS || "success", required: true },
  ];
  if (assignmentMap.has("ai-tester")) {
    checks.push({ name: "ai-tester-step", status: process.env.NAVIXA_AI_TESTER_STEP_STATUS || "unknown", required: Boolean(assignmentMap.get("ai-tester")?.required) });
  }
  if (assignmentMap.has("independent-reviewer")) {
    checks.push({ name: "independent-reviewer-step", status: process.env.NAVIXA_REVIEWER_STEP_STATUS || "unknown", required: Boolean(assignmentMap.get("independent-reviewer")?.required) });
  }

  const events = await readExecutionEvents(process.env.NAVIXA_EVENT_LOG);
  const executionGuard = evaluateLiveExecution({ plan, events, files: plan?.contract?.contextPaths || [] });
  const evidence = aggregateEvidence({
    plan,
    checks,
    reviews,
    executionGuard,
    ciEvidence,
    expectedHeadSha: process.env.NAVIXA_EXPECTED_HEAD_SHA || null,
    requireCiEvidence: process.env.NAVIXA_REQUIRE_CI_EVIDENCE === "true",
  });
  const summary = formatEvidenceSummary(evidence);

  if (process.env.NAVIXA_EVIDENCE_OUTPUT) await writeFile(process.env.NAVIXA_EVIDENCE_OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, "utf8");
  process.stdout.write(`${summary}\n`);
  if (!evidence.mergeAllowed) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`NAVIXA evidence aggregation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
