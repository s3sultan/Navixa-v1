import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTaskContract, parseIssueSections, validateTaskContract } from "../scripts/dev-guardian/task-contract.mjs";
import { buildReviewDispatch, roleInstructions } from "../scripts/dev-guardian/review-dispatch.mjs";
import { buildGuardianPlan, mergeGuardPolicy } from "../scripts/dev-guardian/guardian-task-runner.mjs";
import { buildExternalReviewPrompt, readBoundedContext } from "../scripts/dev-guardian/external-review-runner.mjs";

function issueBody({ allowed = "- app/auth/**\n- tests/auth.test.ts" } = {}) {
  return `### الهدف\nتقوية تسجيل الدخول والمصادقة في \`app/auth/service.ts\`\n\n### معايير القبول\n- رفض الجلسة غير الصالحة\n- نجاح اختبار الانحدار\n\n### مستوى الخطورة\nمرتفع — صلاحيات أو خصوصية أو بيانات أو CI/CD\n\n### الوكيل المقترح\nغير محدد — يختاره المنسق\n\n### Base commit\nlatest-master\n\n### النطاق المسموح\n${allowed}\n\n### الممنوعات\n- .env\n- **/*.key\n\n### الميزانية والمهلة\n20 دقيقة، 10 steps، 4000 tokens، $1.25`;
}

test("issue form sections become a strict task contract", () => {
  const sections = parseIssueSections(issueBody());
  assert.match(sections.get("الهدف"), /تقوية تسجيل الدخول/);

  const repoMap = {
    dependencyGraph: { "app/auth/service.ts": [], "tests/auth.test.ts": ["app/auth/service.ts"] },
    reverseDependencyGraph: { "app/auth/service.ts": ["tests/auth.test.ts"], "tests/auth.test.ts": [] },
    testLinks: { "app/auth/service.ts": ["tests/auth.test.ts"] },
    hotspots: [{ path: "app/auth/service.ts" }],
  };
  const contract = createTaskContract({
    issue: { number: 77, title: "Auth hardening", body: issueBody(), html_url: "https://github.com/example/repo/issues/77" },
    repository: "example/repo",
    baseCommit: "abc123",
    repoMap,
  });

  assert.equal(contract.validation.valid, true);
  assert.equal(contract.risk, "high");
  assert.equal(contract.requestedAgent, "auto");
  assert.equal(contract.signals.securitySensitive, true);
  assert.equal(contract.budget.maxWallMs, 20 * 60_000);
  assert.equal(contract.budget.maxSteps, 10);
  assert.equal(contract.budget.maxTokens, 4000);
  assert.equal(contract.budget.maxCostUsd, 1.25);
  assert.ok(contract.contextPaths.includes("app/auth/service.ts"));
  assert.ok(contract.contextPaths.includes("tests/auth.test.ts"));
});

test("task contract blocks missing allowed scope", () => {
  const contract = createTaskContract({
    issue: { number: 2, title: "Unsafe task", body: issueBody({ allowed: "" }) },
    repository: "example/repo",
    baseCommit: "abc",
    repoMap: { dependencyGraph: {}, reverseDependencyGraph: {}, testLinks: {}, hotspots: [] },
  });
  assert.equal(contract.validation.valid, false);
  assert.ok(contract.validation.errors.includes("missing-allowed-scope"));
  assert.equal(validateTaskContract(contract).valid, false);
});

test("guard policy honors the stricter task budget", () => {
  const policy = mergeGuardPolicy(
    { maxSteps: 28, maxWallMs: 45 * 60_000, stopOnScopeViolation: true },
    { maxSteps: 10, maxWallMs: 20 * 60_000, maxCostUsd: 1.25, maxTokens: 4000 },
  );
  assert.equal(policy.maxSteps, 10);
  assert.equal(policy.maxWallMs, 20 * 60_000);
  assert.equal(policy.maxCostUsd, 1.25);
  assert.equal(policy.maxTokens, 4000);
});

test("independent reviewer is different from executor and security is folded into review", () => {
  const contract = { signals: { needsWrite: true } };
  const route = { primary: "Codex", reviewers: ["Claude Code"], checks: ["security-review"] };
  const dispatch = buildReviewDispatch({ contract, route });
  assert.equal(dispatch.valid, true);
  assert.equal(dispatch.executor, "Codex");
  assert.equal(dispatch.securityRequired, true);
  assert.ok(dispatch.assignments.some((item) => item.role === "ai-tester" && item.agent === "Gemini API / AI Studio"));
  assert.ok(dispatch.assignments.some((item) => item.role === "independent-reviewer" && item.agent === "Manus"));
  assert.ok(dispatch.assignments.every((item) => item.agent !== dispatch.executor));
  assert.match(roleInstructions("independent-reviewer", { securityRequired: true }), /IDOR/);
});

test("bounded context excludes default secret paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "navixa-review-context-"));
  try {
    await mkdir(path.join(root, "app", "auth"), { recursive: true });
    await writeFile(path.join(root, "app", "auth", "service.ts"), "export const ok = true;\n");
    await writeFile(path.join(root, ".env"), "SECRET=never\n");
    await writeFile(path.join(root, "root.key"), "never\n");
    const context = await readBoundedContext({
      root,
      contract: {
        allowedScope: ["**"],
        forbiddenScope: [],
        contextPaths: ["app/auth/service.ts", ".env", "root.key"],
      },
    });
    assert.deepEqual(context.included, ["app/auth/service.ts"]);
    assert.match(context.text, /export const ok/);
    assert.doesNotMatch(context.text, /SECRET=never/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("external prompt carries task contract but forbids write claims", () => {
  const prompt = buildExternalReviewPrompt({
    role: "independent-reviewer",
    plan: {
      contract: { taskId: "x", objective: "review", acceptance: ["pass"], risk: "high", baseCommit: "abc", allowedScope: ["app/**"], forbiddenScope: [".env"], budget: {} },
      route: { primary: "Codex" },
      review: { securityRequired: true },
    },
    contextText: "FILE: app/a.ts\n---\ncode\n---",
  });
  assert.match(prompt, /TASK CONTRACT/);
  assert.match(prompt, /Never claim to push, merge, deploy/);
  assert.match(prompt, /IDOR/);
});

test("guardian planner produces routed contract and two external read-only roles", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "navixa-guardian-plan-"));
  try {
    await mkdir(path.join(root, "app", "auth"), { recursive: true });
    await mkdir(path.join(root, "tests"), { recursive: true });
    await writeFile(path.join(root, "app", "auth", "service.ts"), "export function auth(){ return true; }\n");
    await writeFile(path.join(root, "tests", "auth.test.ts"), 'import { auth } from "../app/auth/service"; void auth;\n');
    const plan = await buildGuardianPlan({
      root,
      repository: "example/repo",
      baseCommit: "abc123",
      issue: { number: 77, title: "Auth hardening", body: issueBody(), html_url: "https://github.com/example/repo/issues/77" },
    });
    assert.equal(plan.contract.validation.valid, true);
    assert.equal(plan.route.primary, "Codex");
    assert.equal(plan.guardPolicy.maxSteps, 10);
    assert.equal(plan.review.securityRequired, true);
    assert.deepEqual(plan.review.assignments.map((item) => item.role).sort(), ["ai-tester", "independent-reviewer"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
