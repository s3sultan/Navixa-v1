#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

export const REQUIRED_NAVIXA_WORKFLOWS = Object.freeze([
  "NAVIXA Dev Guardian Verify",
  "Verify NAVIXA Pull Request",
  "NAVIXA Pre-Launch Gate",
]);

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

function normalizeRun(run = {}) {
  return {
    id: Number(run.id) || null,
    name: String(run.name || ""),
    headSha: String(run.head_sha || run.headSha || ""),
    event: String(run.event || ""),
    status: String(run.status || "unknown").toLowerCase(),
    conclusion: run.conclusion == null ? null : String(run.conclusion).toLowerCase(),
    runNumber: Number(run.run_number ?? run.runNumber) || 0,
    runAttempt: Number(run.run_attempt ?? run.runAttempt) || 1,
    htmlUrl: String(run.html_url || run.htmlUrl || ""),
  };
}

function runOrder(a, b) {
  if (a.runNumber !== b.runNumber) return b.runNumber - a.runNumber;
  if (a.runAttempt !== b.runAttempt) return b.runAttempt - a.runAttempt;
  return (b.id || 0) - (a.id || 0);
}

export function assessWorkflowRuns({ headSha, runs = [], requiredNames = REQUIRED_NAVIXA_WORKFLOWS } = {}) {
  const exactHead = String(headSha || "").trim();
  if (!exactHead) throw new Error("headSha is required.");
  const normalized = runs.map(normalizeRun).filter((run) => run.headSha === exactHead && run.event === "pull_request");
  const checks = [];

  for (const name of requiredNames) {
    const candidates = normalized.filter((run) => run.name === name).sort(runOrder);
    const latest = candidates[0] || null;
    let status = "missing";
    if (latest) {
      if (latest.status !== "completed") status = latest.status || "pending";
      else status = latest.conclusion || "unknown";
    }
    checks.push({
      name,
      required: true,
      status,
      passed: status === "success",
      runId: latest?.id || null,
      runNumber: latest?.runNumber || null,
      runAttempt: latest?.runAttempt || null,
      url: latest?.htmlUrl || null,
      headSha: exactHead,
    });
  }

  const reasons = checks.filter((check) => !check.passed).map((check) => `ci:${check.name}:${check.status}`);
  return {
    schemaVersion: 1,
    headSha: exactHead,
    valid: reasons.length === 0,
    reasons,
    checks,
  };
}

export async function collectGitHubCiEvidence({ repository, prNumber, token, requiredNames = REQUIRED_NAVIXA_WORKFLOWS } = {}) {
  const [owner, repo] = String(repository || "").split("/");
  const number = Number(prNumber);
  if (!owner || !repo || !Number.isSafeInteger(number) || number < 1) throw new Error("Invalid repository or PR number.");
  if (!token) throw new Error("GitHub token is required.");
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "navixa-dev-guardian-ci-evidence",
  };
  const pr = await requestJson(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, { headers }, "GitHub PR read");
  if (pr.state !== "open") throw new Error("CI evidence collection requires an open pull request.");
  const headSha = String(pr.head?.sha || "");
  if (!headSha) throw new Error("Pull request head SHA is missing.");

  const page = await requestJson(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs?head_sha=${encodeURIComponent(headSha)}&event=pull_request&per_page=100`,
    { headers },
    "GitHub workflow runs read",
  );
  const evidence = assessWorkflowRuns({ headSha, runs: page.workflow_runs || [], requiredNames });
  return {
    ...evidence,
    repository,
    prNumber: number,
    prUrl: String(pr.html_url || ""),
  };
}

async function main() {
  const evidence = await collectGitHubCiEvidence({
    repository: required("NAVIXA_REPOSITORY"),
    prNumber: required("NAVIXA_PR_NUMBER"),
    token: required("GITHUB_TOKEN"),
  });
  const payload = `${JSON.stringify(evidence, null, 2)}\n`;
  if (process.env.NAVIXA_CI_EVIDENCE_OUTPUT) await writeFile(process.env.NAVIXA_CI_EVIDENCE_OUTPUT, payload, "utf8");
  process.stdout.write(payload);
  if (!evidence.valid) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`NAVIXA CI evidence collection failed: ${error.message}`);
    process.exitCode = 1;
  });
}
