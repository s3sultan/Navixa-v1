#!/usr/bin/env node

import { appendFile, readFile, writeFile } from "node:fs/promises";
import { evaluateLiveExecution, readExecutionEvents } from "./event-ledger.mjs";

const REVIEW_ORDER = Object.freeze({ CLEAR: 0, MINOR: 1, MAJOR: 2, BLOCKER: 3 });

export function parseReviewVerdict(text = "") {
  const matches = [...String(text).toUpperCase().matchAll(/\b(CLEAR|MINOR|MAJOR|BLOCKER)\b/g)];
  return matches.length ? matches.at(-1)[1] : null;
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

export function aggregateEvidence({ plan, checks = [], reviews = [], executionGuard = { allowed: true } } = {}) {
  const normalizedChecks = checks.map(normalizeCheck);
  const normalizedReviews = reviews.map(normalizeReview);
  const requiredRoles = (plan?.review?.assignments || []).filter((item) => item.required).map((item) => item.role);
  const reasons = [];

  for (const check of normalizedChecks) {
    if (check.required && !check.passed) reasons.push(`check-failed:${check.name}:${check.status}`);
  }

  for (const role of requiredRoles) {
    const evidence = normalizedReviews.find((review) => review.role === role);
    if (!evidence) {
      reasons.push(`missing-review:${role}`);
      continue;
    }
    if (evidence.status !== "success") reasons.push(`review-failed:${role}:${evidence.status}`);
    if (roleRequiresVerdict(role) && !evidence.verdict) reasons.push(`missing-verdict:${role}`);
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
    requiredRoles,
  };
}

export function formatEvidenceSummary(evidence) {
  const checks = evidence.checks.map((item) => `- ${item.name}: ${item.status}${item.required ? " (required)" : ""}`).join("\n") || "- none";
  const reviews = evidence.reviews.map((item) => `- ${item.role} / ${item.agent}: ${item.status}, verdict ${item.verdict || "n/a"}`).join("\n") || "- none";
  const reasons = evidence.reasons.map((item) => `- ${item}`).join("\n") || "- none";
  return `## NAVIXA Dev Guardian evidence\n\n- Verdict: **${evidence.verdict}**\n- Merge allowed by Dev Guardian evidence: **${evidence.mergeAllowed ? "yes" : "no"}**\n\n### Checks\n${checks}\n\n### Reviews\n${reviews}\n\n### Blocking reasons\n${reasons}`;
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
  const evidence = aggregateEvidence({ plan, checks, reviews, executionGuard });
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
