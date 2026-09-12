import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { applyGuardedPatch, parsePatchManifest } from "../scripts/dev-guardian/patch-developer-bridge.mjs";
import { readExecutionEvents } from "../scripts/dev-guardian/event-ledger.mjs";

const execFileAsync = promisify(execFile);

async function git(root, args) {
  const result = await execFileAsync("git", args, { cwd: root });
  return result.stdout.trim();
}

async function makeRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), "navixa-bridge-repo-"));
  await mkdir(path.join(root, "app", "auth"), { recursive: true });
  await writeFile(path.join(root, "app", "auth", "service.ts"), "export const value = 1;\n", "utf8");
  await git(root, ["init"]);
  await git(root, ["config", "user.email", "dev-guardian@example.invalid"]);
  await git(root, ["config", "user.name", "NAVIXA Dev Guardian"]);
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "fixture"]);
  const head = await git(root, ["rev-parse", "HEAD"]);
  return { root, head };
}

function planFixture(baseCommit) {
  return {
    contract: {
      validation: { valid: true, errors: [] },
      baseCommit,
      allowedScope: ["app/auth/**"],
      forbiddenScope: ["app/auth/private/**"],
      contextPaths: ["app/auth/service.ts"],
    },
    route: { primary: "Codex" },
    guardPolicy: { maxSteps: 10, maxTokens: 10000, maxWallMs: 60_000 },
    review: { assignments: [] },
  };
}

async function makePatchDir() {
  return mkdtemp(path.join(os.tmpdir(), "navixa-bridge-patch-"));
}

test("patch manifest rejects binary, symlink, rename, and quoted path features", () => {
  const unsafe = [
    "diff --git a/a.bin b/a.bin\nGIT binary patch\n",
    "diff --git a/link b/link\nnew file mode 120000\n",
    "diff --git a/old.ts b/new.ts\nrename from old.ts\nrename to new.ts\n",
    'diff --git "a/file name.ts" "b/file name.ts"\n',
  ];
  for (const patch of unsafe) {
    const parsed = parsePatchManifest(patch);
    assert.ok(parsed.violations.length > 0);
  }
});

test("guarded developer bridge applies an in-scope patch including a new file", async () => {
  const { root, head } = await makeRepo();
  const patchDir = await makePatchDir();
  try {
    const patchPath = path.join(patchDir, "change.diff");
    const eventLog = path.join(patchDir, "events.jsonl");
    await writeFile(patchPath, `diff --git a/app/auth/service.ts b/app/auth/service.ts\n--- a/app/auth/service.ts\n+++ b/app/auth/service.ts\n@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;\ndiff --git a/app/auth/added.ts b/app/auth/added.ts\nnew file mode 100644\n--- /dev/null\n+++ b/app/auth/added.ts\n@@ -0,0 +1 @@\n+export const added = true;\n`, "utf8");

    const result = await applyGuardedPatch({
      plan: planFixture(head),
      patchPath,
      executor: "Codex",
      eventLog,
      root,
    });

    assert.equal(result.applied, true);
    assert.deepEqual([...result.files].sort(), ["app/auth/added.ts", "app/auth/service.ts"]);
    assert.equal(await readFile(path.join(root, "app", "auth", "service.ts"), "utf8"), "export const value = 2;\n");
    assert.equal(await readFile(path.join(root, "app", "auth", "added.ts"), "utf8"), "export const added = true;\n");
    const events = await readExecutionEvents(eventLog);
    assert.deepEqual(events.map((event) => event.action), ["patch-preflight", "patch-applied"]);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(patchDir, { recursive: true, force: true });
  }
});

test("guarded developer bridge blocks out-of-scope patch before writing", async () => {
  const { root, head } = await makeRepo();
  const patchDir = await makePatchDir();
  try {
    const patchPath = path.join(patchDir, "outside.diff");
    await writeFile(patchPath, `diff --git a/app/billing/charge.ts b/app/billing/charge.ts\nnew file mode 100644\n--- /dev/null\n+++ b/app/billing/charge.ts\n@@ -0,0 +1 @@\n+export const charge = true;\n`, "utf8");
    await assert.rejects(
      applyGuardedPatch({ plan: planFixture(head), patchPath, executor: "Codex", eventLog: path.join(patchDir, "events.jsonl"), root }),
      /Executor Guard blocked patch/,
    );
    assert.equal(await git(root, ["status", "--porcelain=v1", "--untracked-files=all"]), "");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(patchDir, { recursive: true, force: true });
  }
});

test("guarded developer bridge blocks wrong executor and stale base commit", async () => {
  const { root, head } = await makeRepo();
  const patchDir = await makePatchDir();
  try {
    const patchPath = path.join(patchDir, "change.diff");
    await writeFile(patchPath, `diff --git a/app/auth/service.ts b/app/auth/service.ts\n--- a/app/auth/service.ts\n+++ b/app/auth/service.ts\n@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;\n`, "utf8");

    await assert.rejects(
      applyGuardedPatch({ plan: planFixture(head), patchPath, executor: "Claude Code", eventLog: path.join(patchDir, "events-a.jsonl"), root }),
      /executor-mismatch/,
    );
    await assert.rejects(
      applyGuardedPatch({ plan: planFixture("deadbeef"), patchPath, executor: "Codex", eventLog: path.join(patchDir, "events-b.jsonl"), root }),
      /base-commit-mismatch/,
    );
    assert.equal(await git(root, ["status", "--porcelain=v1", "--untracked-files=all"]), "");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(patchDir, { recursive: true, force: true });
  }
});
