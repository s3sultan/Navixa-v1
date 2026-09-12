#!/usr/bin/env node

import { appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildRepositoryMap } from "./repo-intelligence.mjs";
import { createTaskContract } from "./task-contract.mjs";
import { planAgentRoute } from "./router.mjs";
import { buildReviewDispatch } from "./review-dispatch.mjs";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function requestJson(url, options = {}, label = "request") {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(`${label} failed: ${data?.message || `HTTP ${response.status}`}`);
  return data;
}

function untrustedMarkdown(value) {
  return String(value || "").replaceAll("@", "@\u200b");
}

function minPositive(a, b) {
  const values = [a, b].filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.min(...values) : null;
}

export function mergeGuardPolicy(routePolicy = {}, budget = {}) {
  return {
    ...routePolicy,
    maxSteps: minPositive(routePolicy.maxSteps, budget.maxSteps) ?? routePolicy.maxSteps ?? null,
    maxWallMs: minPositive(routePolicy.maxWallMs, budget.maxWallMs) ?? routePolicy.maxWallMs ?? null,
    maxCostUsd: Number.isFinite(budget.maxCostUsd) && budget.maxCostUsd > 0 ? budget.maxCostUsd : null,
    maxTokens: Number.isFinite(budget.maxTokens) && budget.maxTokens > 0 ? budget.maxTokens : null,
  };
}

export function formatGuardianPlan(plan) {
  const assignmentLines = plan.review.assignments.length
    ? plan.review.assignments.map((item) => `- ${item.role}: ${item.agent}${item.required ? " (required)" : ""}`).join("\n")
    : "- none";
  return `## NAVIXA Dev Guardian plan\n\n- Status: planned only\n- Task: \`${plan.contract.taskId}\`\n- Base commit: \`${plan.contract.baseCommit}\`\n- Risk: \`${plan.contract.risk}\`\n- Primary: **${plan.route.primary}**\n- Scope entries: ${plan.contract.allowedScope.length} allowed / ${plan.contract.forbiddenScope.length} forbidden\n- Context files: ${plan.contract.contextPaths.length}\n- Guard: max steps ${plan.guardPolicy.maxSteps ?? "unset"}, max wall ${plan.guardPolicy.maxWallMs ?? "unset"} ms\n\n### Review dispatch\n${assignmentLines}\n\nExternal AI calls are not started by this planning step. They require the explicit manual workflow option. Nothing was merged or deployed.`;
}

export async function buildGuardianPlan({ issue, repository, baseCommit, root = process.cwd() }) {
  const repoMap = await buildRepositoryMap(root);
  const contract = createTaskContract({ issue, repository, baseCommit, repoMap });
  if (!contract.validation.valid) {
    throw new Error(`Task contract blocked: ${contract.validation.errors.join(", ")}`);
  }
  const route = planAgentRoute({
    risk: contract.risk,
    needsWrite: contract.signals.needsWrite,
    securitySensitive: contract.signals.securitySensitive,
    ui: contract.signals.uiSensitive,
    externalIntegration: contract.signals.externalIntegration,
    filesEstimated: contract.signals.filesEstimated,
  });
  const review = buildReviewDispatch({ contract, route, executor: route.primary });
  if (!review.valid) throw new Error(`Review dispatch blocked: ${review.violations.join(", ") || "no independent reviewer"}`);
  const guardPolicy = mergeGuardPolicy(route.guardPolicy, contract.budget);
  return { schemaVersion: 1, contract, route, review, guardPolicy, repoSummary: repoMap.summary };
}

async function main() {
  const githubToken = required("GITHUB_TOKEN");
  const repository = required("NAVIXA_REPOSITORY");
  const issueNumber = Number(required("NAVIXA_ISSUE_NUMBER"));
  const baseCommit = required("NAVIXA_BASE_COMMIT");
  const triggerActor = required("NAVIXA_TRIGGER_ACTOR");
  const outputPath = process.env.NAVIXA_PLAN_OUTPUT || path.join(process.cwd(), ".navixa-dev-guardian-plan.json");
  const [owner, repo] = repository.split("/");
  if (!owner || !repo || !Number.isSafeInteger(issueNumber) || issueNumber < 1) throw new Error("Invalid repository or issue number.");
  if (triggerActor !== owner) throw new Error("Only the repository owner may start a Dev Guardian plan.");

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${githubToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "navixa-dev-guardian",
  };
  const issue = await requestJson(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, { headers }, "GitHub issue read");
  if (issue.state !== "open") throw new Error("Only open issues can be planned.");

  const plan = await buildGuardianPlan({ issue, repository, baseCommit });
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  const comment = formatGuardianPlan(plan);
  await requestJson(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ body: untrustedMarkdown(comment).slice(0, 65000) }),
    },
    "GitHub plan comment",
  );

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `plan_file=${outputPath}\n`, "utf8");
    await appendFile(process.env.GITHUB_OUTPUT, `has_ai_tester=${plan.review.assignments.some((item) => item.role === "ai-tester") ? "true" : "false"}\n`, "utf8");
    await appendFile(process.env.GITHUB_OUTPUT, `has_independent_reviewer=${plan.review.assignments.some((item) => item.role === "independent-reviewer") ? "true" : "false"}\n`, "utf8");
    await appendFile(process.env.GITHUB_OUTPUT, `security_review=${plan.review.assignments.some((item) => item.role === "security-reviewer") ? "true" : "false"}\n`, "utf8");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`NAVIXA Dev Guardian plan failed: ${error.message}`);
    process.exitCode = 1;
  });
}
