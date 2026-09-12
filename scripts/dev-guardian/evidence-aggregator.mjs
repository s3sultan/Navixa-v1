#!/usr/bin/env node

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
    if (!evidence.verdict) reasons.push(`missing-verdict:${role}`);
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
    reasons,
    checks: normalizedChecks,
    reviews: normalizedReviews,
    requiredRoles,
  };
}

export function formatEvidenceSummary(evidence) {
  const checks = evidence.checks.map((item) => `- ${item.name}: ${item.status}${item.required ? " (required)" : ""}`).join("\n") || "- none";
  const reviews = evidence.reviews.map((item) => `- ${item.role} / ${item.agent}: ${item.status}, verdict ${item.verdict || "missing"}`).join("\n") || "- none";
  const reasons = evidence.reasons.map((item) => `- ${item}`).join("\n") || "- none";
  return `## NAVIXA Dev Guardian evidence\n\n- Verdict: **${evidence.verdict}**\n- Merge allowed by Dev Guardian evidence: **${evidence.mergeAllowed ? "yes" : "no"}**\n\n### Checks\n${checks}\n\n### Reviews\n${reviews}\n\n### Blocking reasons\n${reasons}`;
}
