const RISK_ORDER = Object.freeze({ low: 0, medium: 1, high: 2, critical: 3 });

const AGENTS = Object.freeze({
  codex: {
    id: "Codex",
    canWrite: true,
    canRunTests: true,
    strengths: ["implementation", "repository", "testing"],
  },
  claude: {
    id: "Claude Code",
    canWrite: true,
    canRunTests: true,
    strengths: ["review", "architecture", "implementation"],
  },
  manus: {
    id: "Manus",
    canWrite: false,
    canRunTests: false,
    strengths: ["independent-review", "research", "patch-design"],
  },
  gemini: {
    id: "Gemini API / AI Studio",
    canWrite: false,
    canRunTests: false,
    strengths: ["bounded-review", "patch-design"],
  },
});

function normalizeRisk(value) {
  const risk = String(value || "medium").toLowerCase();
  return Object.hasOwn(RISK_ORDER, risk) ? risk : "medium";
}

function unique(values) {
  return [...new Set(values)];
}

export function planAgentRoute(task = {}) {
  const risk = normalizeRisk(task.risk);
  const riskLevel = RISK_ORDER[risk];
  const needsWrite = task.needsWrite !== false;
  const securitySensitive = Boolean(task.securitySensitive || task.auth || task.billing || task.secrets || task.webhooks);
  const uiSensitive = Boolean(task.ui || task.visual);
  const externalIntegration = Boolean(task.externalIntegration);
  const largeChange = Boolean(task.largeChange || (Number(task.filesEstimated) || 0) >= 12);

  const primary = needsWrite ? AGENTS.codex.id : AGENTS.gemini.id;
  const reviewers = [];

  if (riskLevel >= RISK_ORDER.medium || largeChange) reviewers.push(AGENTS.claude.id);
  if (riskLevel >= RISK_ORDER.high || securitySensitive || externalIntegration) reviewers.push(AGENTS.manus.id);
  if (!needsWrite || task.requireBoundedSecondOpinion) reviewers.push(AGENTS.gemini.id);

  const checks = ["existing-navixa-tests", "scope-guard", "budget-guard", "stuck-guard"];
  if (securitySensitive || riskLevel >= RISK_ORDER.high) checks.push("security-review");
  if (uiSensitive) checks.push("visual-review");
  if (needsWrite) checks.push("independent-review", "pre-launch-gate");

  const approvalGates = ["before-merge"];
  if (riskLevel >= RISK_ORDER.high || securitySensitive || externalIntegration) approvalGates.unshift("before-execution");
  if (risk === "critical") approvalGates.push("before-production");

  const maxSteps = risk === "low" ? 12 : risk === "medium" ? 20 : 28;
  const maxWallMs = risk === "low" ? 15 * 60 * 1000 : risk === "medium" ? 30 * 60 * 1000 : 45 * 60 * 1000;

  return {
    schemaVersion: 1,
    risk,
    planner: "NAVIXA Planner",
    primary,
    reviewers: unique(reviewers).filter((agent) => agent !== primary),
    checks: unique(checks),
    approvalGates: unique(approvalGates),
    guardPolicy: {
      maxSteps,
      maxWallMs,
      stopOnScopeViolation: true,
      stopOnRepeatedFailure: true,
      stopOnOscillation: true,
    },
    rationale: {
      needsWrite,
      securitySensitive,
      uiSensitive,
      externalIntegration,
      largeChange,
    },
  };
}

export function agentCatalog() {
  return Object.values(AGENTS).map((agent) => ({ ...agent, strengths: [...agent.strengths] }));
}
