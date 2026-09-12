const GEMINI = "Gemini API / AI Studio";
const MANUS = "Manus";

function uniqueAssignments(assignments) {
  const seen = new Set();
  return assignments.filter((assignment) => {
    const key = `${assignment.agent}:${assignment.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function chooseIndependentReviewer(executor, preferred = []) {
  const candidates = [...preferred, MANUS, GEMINI].filter(Boolean);
  return candidates.find((candidate) => candidate !== executor) || null;
}

export function buildReviewDispatch({ contract, route, executor } = {}) {
  const primaryExecutor = executor || route?.primary || contract?.requestedAgent || "Codex";
  // Automated stage-two review is intentionally restricted to the connected
  // read-only providers. Route reviewers such as Claude Code remain valid
  // manual/agent reviewers but are not silently treated as callable bridges.
  const independentReviewer = chooseIndependentReviewer(primaryExecutor, [MANUS, GEMINI]);
  const securityRequired = Boolean(route?.checks?.includes("security-review"));
  const assignments = [];

  if (GEMINI !== primaryExecutor) {
    assignments.push({
      role: "ai-tester",
      agent: GEMINI,
      required: Boolean(contract?.signals?.needsWrite),
      objective: "Find missing tests, regressions, edge cases, and false assumptions without modifying the repository.",
    });
  }

  if (independentReviewer) {
    assignments.push({
      role: "independent-reviewer",
      agent: independentReviewer,
      required: Boolean(contract?.signals?.needsWrite),
      securityRequired,
      objective: securityRequired
        ? "Review independently from the executor, include a security threat review, and classify the result as CLEAR, MINOR, MAJOR, or BLOCKER."
        : "Review independently from the executor and classify the result as CLEAR, MINOR, MAJOR, or BLOCKER.",
    });
  }

  const normalized = uniqueAssignments(assignments);
  const independenceViolations = normalized.filter((assignment) => assignment.agent === primaryExecutor);
  return {
    schemaVersion: 1,
    executor: primaryExecutor,
    routeReviewers: Array.isArray(route?.reviewers) ? [...route.reviewers] : [],
    securityRequired,
    assignments: normalized,
    valid: independenceViolations.length === 0 && (!contract?.signals?.needsWrite || Boolean(independentReviewer)),
    violations: independenceViolations.map((assignment) => `reviewer-matches-executor:${assignment.role}:${assignment.agent}`),
  };
}

export function roleInstructions(role, { securityRequired = false } = {}) {
  if (role === "ai-tester") {
    return [
      "Act as NAVIXA AI Tester in read-only mode.",
      "Look for missing regression tests, authorization boundaries, edge cases, error states, concurrency risks, and behavior not proven by the supplied tests.",
      "Do not implement or apply code. Return proposed tests or a Unified Diff only as review material.",
      "Classify each finding by severity and distinguish evidence from speculation.",
    ].join("\n");
  }
  const instructions = [
    "Act as NAVIXA Independent Reviewer in read-only mode.",
    "You must be independent from the implementation agent and review the supplied task contract, bounded context, and evidence.",
    "Do not implement, merge, or deploy. Identify correctness, maintainability, scope, and regression issues.",
  ];
  if (securityRequired) {
    instructions.push("Also perform a security review covering broken access control/IDOR, auth/session handling, injection, XSS, CSRF, SSRF, path traversal, secrets, billing/webhook integrity, rate limits, and privacy where applicable.");
  }
  instructions.push("End with exactly one verdict: CLEAR, MINOR, MAJOR, or BLOCKER.");
  return instructions.join("\n");
}
