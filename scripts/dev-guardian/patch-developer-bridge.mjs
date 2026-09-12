#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { validateExecutorMutation } from "./executor-guard.mjs";
import { readExecutionEvents, recordGuardedExecutionEvent } from "./event-ledger.mjs";

const execFileAsync = promisify(execFile);
const MAX_PATCH_BYTES = 250_000;
const MAX_PATCH_FILES = 40;

function fingerprint(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function normalizePatchPath(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "/dev/null") return null;
  const withoutPrefix = raw.startsWith("a/") || raw.startsWith("b/") ? raw.slice(2) : raw;
  return path.posix.normalize(withoutPrefix.replaceAll("\\", "/"));
}

function isInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function parsePatchManifest(patchText = "") {
  const text = String(patchText);
  const forbiddenMarkers = [
    /^GIT binary patch$/m,
    /^Binary files .* differ$/m,
    /^new file mode 120000$/m,
    /^old mode 120000$/m,
    /^rename from /m,
    /^rename to /m,
    /^copy from /m,
    /^copy to /m,
  ];
  const violations = [];
  for (const marker of forbiddenMarkers) {
    if (marker.test(text)) violations.push(`unsupported-patch-feature:${marker.source}`);
  }

  const files = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("diff --git ")) continue;
    if (line.includes('"')) {
      violations.push("quoted-or-escaped-path-not-supported");
      continue;
    }
    const parts = line.split(" ");
    if (parts.length !== 4 || !parts[2].startsWith("a/") || !parts[3].startsWith("b/")) {
      violations.push("malformed-diff-header");
      continue;
    }
    const before = normalizePatchPath(parts[2]);
    const after = normalizePatchPath(parts[3]);
    if (before && after && before !== after) violations.push(`rename-not-supported:${before}:${after}`);
    for (const candidate of [before, after]) {
      if (candidate && !files.includes(candidate)) files.push(candidate);
    }
  }

  if (!files.length) violations.push("patch-has-no-files");
  if (files.length > MAX_PATCH_FILES) violations.push(`too-many-files:${files.length}:${MAX_PATCH_FILES}`);
  return { files, violations: [...new Set(violations)] };
}

async function git(root, args, { trim = true } = {}) {
  const result = await execFileAsync("git", args, {
    cwd: root,
    maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  return {
    stdout: trim ? result.stdout.trim() : result.stdout,
    stderr: trim ? result.stderr.trim() : result.stderr,
  };
}

function parsePorcelainZ(value = "") {
  return String(value)
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.length >= 4 ? entry.slice(3) : "")
    .filter(Boolean);
}

async function workingTreeFiles(root) {
  const status = await git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { trim: false });
  return parsePorcelainZ(status.stdout);
}

async function restoreCleanTree(root) {
  await git(root, ["reset", "--hard", "HEAD"]);
  await git(root, ["clean", "-fd"]);
}

export async function applyGuardedPatch({
  plan,
  patchPath,
  executor,
  eventLog = "",
  root = process.cwd(),
} = {}) {
  const repositoryRoot = path.resolve(root);
  const absolutePatch = path.resolve(patchPath || "");
  if (!patchPath) throw new Error("patchPath is required.");
  if (isInsideRoot(repositoryRoot, absolutePatch)) throw new Error("Patch file must live outside the repository working tree.");
  if (eventLog && isInsideRoot(repositoryRoot, path.resolve(eventLog))) throw new Error("Event log must live outside the repository working tree.");

  const patchText = await readFile(absolutePatch, "utf8");
  const patchBytes = Buffer.byteLength(patchText);
  if (patchBytes < 1) throw new Error("Patch is empty.");
  if (patchBytes > MAX_PATCH_BYTES) throw new Error(`Patch exceeds ${MAX_PATCH_BYTES} bytes.`);
  const manifest = parsePatchManifest(patchText);
  if (manifest.violations.length) throw new Error(`Patch manifest blocked: ${manifest.violations.join(", ")}`);

  const head = (await git(repositoryRoot, ["rev-parse", "HEAD"])).stdout;
  const initialFiles = await workingTreeFiles(repositoryRoot);
  if (initialFiles.length) throw new Error("Working tree must be clean before guarded patch application.");

  const events = await readExecutionEvents(eventLog);
  const decision = validateExecutorMutation({
    plan,
    executor,
    baseCommit: head,
    changedFiles: manifest.files,
    events,
  });
  if (!decision.allowed) throw new Error(`Executor Guard blocked patch: ${decision.reasons.join(", ")}`);

  const start = await recordGuardedExecutionEvent({
    filePath: eventLog,
    plan,
    files: manifest.files,
    event: {
      role: "developer",
      agent: executor,
      action: "patch-preflight",
      target: `${manifest.files.length}-files`,
      ok: true,
      progressHash: `patch:${fingerprint(patchText)}:preflight`,
      usageDelta: { steps: 1 },
    },
  });
  if (!start.guard.allowed) throw new Error(`Live guard blocked patch preflight: ${start.guard.reasons.join(", ")}`);

  await git(repositoryRoot, ["apply", "--check", "--whitespace=error-all", absolutePatch]);
  await git(repositoryRoot, ["apply", "--whitespace=error-all", absolutePatch]);

  const actualFiles = await workingTreeFiles(repositoryRoot);
  const postDecision = validateExecutorMutation({
    plan,
    executor,
    baseCommit: head,
    changedFiles: actualFiles,
    events: await readExecutionEvents(eventLog),
  });
  const unexpected = actualFiles.filter((file) => !manifest.files.includes(file));
  const missing = manifest.files.filter((file) => !actualFiles.includes(file));
  if (!postDecision.allowed || unexpected.length || missing.length) {
    await restoreCleanTree(repositoryRoot);
    await recordGuardedExecutionEvent({
      filePath: eventLog,
      plan,
      files: manifest.files,
      event: {
        role: "developer",
        agent: executor,
        action: "patch-rolled-back",
        target: `${manifest.files.length}-files`,
        ok: false,
        error: [...postDecision.reasons, ...unexpected.map((file) => `unexpected-file:${file}`), ...missing.map((file) => `missing-file:${file}`)].join(", "),
        progressHash: `patch:${fingerprint(patchText)}:rollback`,
        usageDelta: { steps: 1 },
      },
    });
    throw new Error(`Post-apply guard blocked workspace: ${[...postDecision.reasons, ...unexpected.map((file) => `unexpected-file:${file}`), ...missing.map((file) => `missing-file:${file}`)].join(", ")}`);
  }

  const completed = await recordGuardedExecutionEvent({
    filePath: eventLog,
    plan,
    files: actualFiles,
    event: {
      role: "developer",
      agent: executor,
      action: "patch-applied",
      target: `${actualFiles.length}-files`,
      ok: true,
      progressHash: `patch:${fingerprint(patchText)}:applied`,
      usageDelta: { steps: 1 },
    },
  });
  if (!completed.guard.allowed) {
    await restoreCleanTree(repositoryRoot);
    throw new Error(`Live guard blocked continuation after patch; workspace rolled back: ${completed.guard.reasons.join(", ")}`);
  }

  return {
    schemaVersion: 1,
    applied: true,
    executor,
    baseCommit: head,
    patchFingerprint: fingerprint(patchText),
    files: actualFiles,
    guard: completed.guard,
  };
}

async function main() {
  const planPath = process.env.NAVIXA_PLAN_FILE;
  const patchPath = process.env.NAVIXA_PATCH_FILE;
  const executor = process.env.NAVIXA_EXECUTOR;
  if (!planPath || !patchPath || !executor) throw new Error("NAVIXA_PLAN_FILE, NAVIXA_PATCH_FILE and NAVIXA_EXECUTOR are required.");
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const result = await applyGuardedPatch({
    plan,
    patchPath,
    executor,
    eventLog: process.env.NAVIXA_EVENT_LOG || "",
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`NAVIXA patch developer bridge failed: ${error.message}`);
    process.exitCode = 1;
  });
}
