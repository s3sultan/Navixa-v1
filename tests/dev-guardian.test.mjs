import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildRepositoryMap } from "../scripts/dev-guardian/repo-intelligence.mjs";
import { detectStuck, evaluateBudget, evaluateScope, guardAgentRun } from "../scripts/dev-guardian/guards.mjs";
import { planAgentRoute } from "../scripts/dev-guardian/router.mjs";

test("scope guard accepts allowed files and blocks forbidden or unsafe files", () => {
  const result = evaluateScope({
    files: [
      "scripts/dev-guardian/router.mjs",
      "private/client.key",
      "client.key",
      "../outside.ts",
      "/etc/passwd",
    ],
    allowed: ["**"],
    forbidden: ["**/*.key"],
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(result.accepted, ["scripts/dev-guardian/router.mjs"]);
  assert.deepEqual(result.blocked, [
    { file: "private/client.key", reason: "forbidden-scope" },
    { file: "client.key", reason: "forbidden-scope" },
    { file: "../outside.ts", reason: "unsafe-path" },
    { file: "/etc/passwd", reason: "unsafe-path" },
  ]);
});

test("budget guard stops at configured step, token, cost, and wall limits", () => {
  const result = evaluateBudget({
    limits: { maxSteps: 10, maxTokens: 5000, maxCostUsd: 1.5, maxWallMs: 60_000 },
    usage: { steps: 10, tokens: 5100, costUsd: 1.5, startedAt: 10_000, now: 70_000 },
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(result.reasons.sort(), ["max-cost", "max-steps", "max-tokens", "max-wall-time"]);
});

test("stuck detector catches repeated errors", () => {
  const events = [
    { action: "test", target: "app/a.ts", error: "same failure", ok: false },
    { action: "edit", target: "app/a.ts", error: "same failure", ok: false },
    { action: "test", target: "app/a.ts", error: "same failure", ok: false },
  ];
  const result = detectStuck(events);
  assert.equal(result.stuck, true);
  assert.ok(["repeated-error", "consecutive-failures"].includes(result.reason));
});

test("stuck detector catches A/B oscillation without false failure signal", () => {
  const events = [
    { action: "edit", target: "a.ts", ok: true, result: "a1" },
    { action: "edit", target: "b.ts", ok: true, result: "b1" },
    { action: "edit", target: "a.ts", ok: true, result: "a2" },
    { action: "edit", target: "b.ts", ok: true, result: "b2" },
    { action: "edit", target: "a.ts", ok: true, result: "a3" },
    { action: "edit", target: "b.ts", ok: true, result: "b3" },
  ];
  const result = detectStuck(events);
  assert.equal(result.stuck, true);
  assert.equal(result.reason, "oscillation");
});

test("combined guard allows healthy bounded progress", () => {
  const result = guardAgentRun({
    files: ["app/voice/voiceEngine.ts"],
    allowed: ["app/voice/**"],
    forbidden: ["**/*.key"],
    limits: { maxSteps: 20, maxWallMs: 120_000 },
    usage: { steps: 5, startedAt: 1_000, now: 50_000 },
    events: [
      { action: "read", target: "app/voice/voiceEngine.ts", ok: true, progressHash: "1" },
      { action: "edit", target: "app/voice/voiceEngine.ts", ok: true, progressHash: "2" },
    ],
  });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasons, []);
});

test("agent router escalates security-sensitive writes to independent review", () => {
  const plan = planAgentRoute({
    risk: "high",
    needsWrite: true,
    securitySensitive: true,
    filesEstimated: 5,
  });

  assert.equal(plan.primary, "Codex");
  assert.ok(plan.reviewers.includes("Claude Code"));
  assert.ok(plan.reviewers.includes("Manus"));
  assert.ok(plan.checks.includes("security-review"));
  assert.ok(plan.checks.includes("pre-launch-gate"));
  assert.ok(plan.approvalGates.includes("before-execution"));
});

test("repo intelligence maps routes, aliases, reverse dependencies, and tests", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "navixa-dev-guardian-"));
  try {
    await mkdir(path.join(root, "app", "api", "health"), { recursive: true });
    await mkdir(path.join(root, "lib"), { recursive: true });
    await mkdir(path.join(root, "tests"), { recursive: true });
    await mkdir(path.join(root, ".github", "workflows"), { recursive: true });

    await writeFile(path.join(root, "app", "page.tsx"), 'import { service } from "@/lib/service"; export default function Page(){ return service(); }\n');
    await writeFile(path.join(root, "app", "api", "health", "route.ts"), 'import { service } from "@/lib/service"; export function GET(){ return service(); }\n');
    await writeFile(path.join(root, "lib", "service.ts"), 'export function service(){ return "ok"; }\n');
    await writeFile(path.join(root, "tests", "service.test.ts"), 'import { service } from "../lib/service"; void service;\n');
    await writeFile(path.join(root, ".github", "workflows", "verify.yml"), "name: verify\n");
    await writeFile(path.join(root, "package.json"), '{"name":"fixture"}\n');

    const map = await buildRepositoryMap(root);
    assert.equal(map.summary.files, 6);
    assert.equal(map.summary.unresolvedInternalImports, 0);
    assert.ok(map.routes.some((route) => route.path === "app/page.tsx" && route.route === "/"));
    assert.ok(map.routes.some((route) => route.path === "app/api/health/route.ts" && route.route === "/api/health"));
    assert.deepEqual(map.dependencyGraph["app/page.tsx"], ["lib/service.ts"]);
    assert.ok(map.reverseDependencyGraph["lib/service.ts"].includes("app/page.tsx"));
    assert.ok(map.testLinks["lib/service.ts"].includes("tests/service.test.ts"));
    const serviceHotspot = map.hotspots.find((item) => item.path === "lib/service.ts");
    assert.ok(serviceHotspot);
    assert.ok(serviceHotspot.incoming >= 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
